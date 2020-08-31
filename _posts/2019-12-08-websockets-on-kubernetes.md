---
layout: post
title:  "Playing with WebSockets on Kubernetes using Go"
date:   2019-12-08 21:08:43 +00:00
categories: [kubernetes]
tags: [websockets, go, kubernetes, draft]
---

Given my background in real-time data streaming, I wanted to experiment with building an application with such characteristics for the Web and try to run it on Kubernetes. This post explores how I built a simple WebSockets based application in Go and hosted it on my Kubernetes cluster.

## WebSockets

Let's start with a quick recap of what WebSockets are and how they work.

### What are WebSockets?

WebSockets are a mechanism to create a TCP like connection in the web stack. They are an extension to the HTTP protocol on supported web servers and clients.

### How WebSockets work?

WebSockets start with a normal HTTP connection which requests a connection "Upgrade" to the type of "websocket". After the handshake exchange, the connection remains open, allowing bidirectional messages similar to a normal network socket.

Since the underlying protocol is HTTP and the rest of the protocol is basically a long-living payload exchange, WebSockets inherit many characteristics such as:
- SSL/TLS support
- Distribution middleware (proxies and load balancers)
- Rely on the same L3/L4 firewall rules as normal web traffic
- Supports HTTP headers such as cookies or compression settings

## The Application

I'm planning on building a simple application that exhibits the characteristics of real-time data streaming. It will consist of a server-side component and HTML/JavaScript client-side app which will communicate over a WebSocket.

To make things easier, I'll make the server-side component serve the client-side application as a static asset over HTTP. Since its basically a web server, I'll throw in a health end-point too to allow HTTP probes on the application.

For the WebSocket connection, I'll make the server do a couple of "real-time-ey" things, firstly it will echo back any messages it receives from the client, secondly, it'll send messages to the client at random times.

I'll be using **Go** for this application as I've been meaning to find more opportunities to use it. For a container development and deployment workflow, I'll be using [Draft](https://draft.sh/).

### Bootstrapping the project

We'll start by running `draft create -p go` to bootstrap the draft project, and then create a couple of files `main.go` for the main server-side component and `index.html` for the client-side app.

Once set up, I can simply run `draft up` (and then `draft connect`) to connect to my development Kubernetes instance.

## The server-side application

### Serving static content

Let's create a basic web server that serves only a single page. In this case, the file: `index.html`.

`main.go`
```go
package main

import (
    "io/ioutil"
    "log"
    "net/http"
)

func defaultHandler(w http.ResponseWriter, r *http.Request) {
    content, _ := ioutil.ReadFile("index.html")
    w.Header().Set("Content-Type", "text/html")
    w.Write(content)
}

func main() {
    http.HandleFunc("/", defaultHandler)
    log.Fatal(http.ListenAndServe(":8080", nil))
}
```

`index.html`
```html
<!DOCTYPE html>
<html>
<body>
HELLO WORLD
</body>
</html>
```

Now for a quick test:

```sh
$ draft connect
Connect to gowebsockettest:8080 on localhost:64993
```

```sh
$ curl http://localhost:64993
<!DOCTYPE html>
<html>
<body>
HELLO WORLD
</body>
</html>
```

Great! we've built a... web server, one that only serves a single file.

### Adding a health end-point

We can now add a simple health end-point which we'll register as the convention `/healthz` by adding the following to `main.go`.

```go
func healthzHandler(w http.ResponseWriter, r *http.Request) {
    w.Write([]byte("OK"))
}

func main() {
    http.HandleFunc("/healthz", healthzHandler)
    // ...
}
```

```sh
$ curl http://localhost:65400/healthz
OK
```

### Accepting WebSocket connections

There are multiple options for adding WebSocket support in Go, at the time of writing, it seemed that the [Gorilla WebSocket](https://github.com/gorilla/websocket) implementation provided the best features. This package works on top of `net/http` by taking an existing connection and "upgrading" it to a WebSocket.

`main.go`
```go
import {
    // ...
    "github.com/gorilla/websocket"
}

// The upgrader which will perform the HTTP connection upgrade to WebSocket
var upgrader = websocket.Upgrader{
    ReadBufferSize:  1024,
    WriteBufferSize: 1024,
}

func websocketHandler(w http.ResponseWriter, r *http.Request) {
    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        log.Println(err)
        return
    }
    log.Printf("Connection from %v", conn.RemoteAddr())
}

func main() {
    http.HandleFunc("/websocket", websocketHandler)
    // ...
}
```

Now that the server is capable of accepting WebSocket connections, let's switch to the client-side application.

## The client-side application

To keep things simple, I'll put all the HTML and JavaScript in a single file, a literal single page application if you will.

### Creating a basic web page

We'll start with some basic HTML.

`index.html`
```html
<!DOCTYPE html>
<html>
<head>
    <title>Go WebSocket Test</title>
    <script>
        // JavaScript hoes here
    </script>
</head>
<body>
    <input id="payload" type="text" />
    <button id="send">Send</button>
    <pre id="log"></pre>
</body>
</html>
```

Next, we'll add some helpful utility functions.

```js
// Helper function to log messages
function log(message) {
    var logElement = document.getElementById("log");
    logElement.innerText += new Date().toISOString() + ": " + message + "\n";
}

// Helper function to generate a WebSocket from the current location
function getWsUrl() {
    var loc = window.location, new_uri;
    if (loc.protocol === "https:") {
        new_uri = "wss:";
    } else {
        new_uri = "ws:";
    }
    new_uri += "//" + loc.host + "/websocket";
    return new_uri;
}
```

### Creating a WebSocket connection

The JavaScript WebSocket API is pretty straight-forward, taking a target URL on construction and exposing several properties to bind to events. To create a WebSocket and handle events through its lifetime:

```js
var ws;
function connect() {
    log("Connecting");
    ws = new WebSocket(getWsUrl());
    ws.onopen = () => {
        log("Connected");
    };

    ws.onmessage = (event) => {
        log("Received: " + event.data);
    };

    ws.onclose = (event) => {
        // We'll reconnect indefinitely
        log("Connection Closed, Reconnecting");
        setTimeout(connect, 1000);
    };

    ws.onerror = (error) => {
        // On any error, just close and cause a reconnect
        log("Error, Closing");
        ws.close();
    };
}
```

And finally to connect everything together:

```js
window.onload = (event) => {
    // Connect button and input to send messages
    document.getElementById('send').onclick = (event) => {
        ws.send(document.getElementById("payload").value);
    }
    // Start a connection
    connect();
};
```

## The real-time streaming part

Now, let's get back to the server-side application and make it actually do something in real-time.

### 1. Echo messages

Firstly we'll create a function which will read messages and try to echo them back. Upon any failure (including due to the client-side application disconnecting), we'll simply close the connection.

```go
func websocketEcho(conn *websocket.Conn) {
    for {
        mt, message, err := conn.ReadMessage()
        if err != nil {
            log.Println("Read Error:", err)
            break
        }
        log.Printf("Received Message: %s from %v", message, conn.RemoteAddr())
        err = conn.WriteMessage(mt, message)
        if err != nil {
            log.Println("Write Error:", err)
            break
        }
    }
    conn.Close()
}
```

### 2. Send messages at random intervals

Next, we will send messages at random intervals of up to 3 seconds based on a randomised sleep. To keep things simple, we'll stop on error, and leave the clean-up of closing the connection to the echo function.

```go
func websocketRandPing(conn *websocket.Conn) {
    for {
        err := conn.WriteMessage(websocket.TextMessage, []byte("randping"))
        if err != nil {
            log.Println(err)
            return
        }
        time.Sleep(time.Duration(rand.Intn(int(time.Second * 3))))
    }
}
```

### Putting it all together

To connect everything together, we can then use "Goroutines" which are great for running such async tasks in the background. We will extend the `websocketHandler` function to invoke the two functions we added earlier as Goroutines.

```go
func websocketHandler(w http.ResponseWriter, r *http.Request) {
    // ...
    go websocketEcho(conn)
    go websocketRandPing(conn)
}
```

## Deployment

With this simple application built, how would we run such an application on Kubernetes? Well, as it turns out, very easily. Since WebSockets are based on HTTP, all the standard HTTP distribution features such as ingress and load balancers work exactly the same. 

Luckily, Draft has already generated a Helm chart which creates a deployment and exposes a service. It can optionally be configured to use an ingress. For my cluster, I will be using the following configuration:

`values.yaml`
```yaml
replicaCount: 1
image:
  # My personal repo that draft pushes to
  pullPolicy: Always
  repository: eyjohn/gowebsockettest
  tag: latest
service:
  name: gowebsockettest
  type: NodePort
  externalPort: 80
  internalPort: 8080
resources:
  limits:
    cpu: 100m
    memory: 128Mi
  requests:
    cpu: 100m
    memory: 128Mi
ingress:
  # My cluster has an ingress controller
  enabled: true
  hosts:
    - gowebsockettest.homelab.evdev.me
  annotations:
    # I can use my certificate manager to ass https/wss
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
  tls:
  - hosts:
    - gowebsockettest.homelab.evdev.me
    secretName: gowebsockettest-tls
# I had to extend the helm charts to support probes
readinessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 10
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 15
  periodSeconds: 20
```

To install this, I can simply run:

```sh
helm install -n gowebsockettest charts/gowebsockettest/ -f values.yaml
```

Once the deployment has completed, we can now test it on the end-point: [gowebsockettest.homelab.evdev.me](https://gowebsockettest.homelab.evdev.me).

## Demo

Here is a quick demo of the client-side application and server side logs:

{:refdef: style="text-align: center;"}
![Screen capture of the client side app and server logs]({{ "/assets/posts/websockets-on-kubernetes/demo.gif" | relative_url }})
{:refdef}

## Conclusion

WebSockets were incredibly easy to get started with, especially in Go where Goroutines made asynchronous event handling very trivial. They fit well within the web-stack, so all the HTTP related set up worked just like with any normal web application. Therefore they allow a natural Kubernetes development and deployment workflow and I had no issues with any development tools or when deploying the applications to my Kubernetes cluster. This definitely goes to show that a web-based platform has a lot to offer for writing real-time data streaming applications and that it fits well within a Kubernetes environment.

You can find a working version of the project repository on my GitHub repository [eyjohn/gowebsockettest](https://github.com/eyjohn/gowebsockettest) and a live version of this app on [gowebsockettest.homelab.evdev.me](https://gowebsockettest.homelab.evdev.me) for however long that I keep it running.

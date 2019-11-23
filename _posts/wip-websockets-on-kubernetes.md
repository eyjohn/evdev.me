---
layout: post
title:  "Playing with WebSockets on Kubernetes using Go"
date:   2019-11-16 18:11:40 +00:00
categories: [kubernetes]
tags: [websockets, go, kubernetes, draft]
---

Given my background in real-time data streaming, I wanted to experiment with building applications with such characteristics for the Web and try to run them on Kubernetes. This post explores how I built a simple WebSockets based application in Go and hosted it on my Kubernetes cluster.

## WebSockets

Let's start with a quick recap of what WebSockets are how they work.

### What are WebSockets?

WebSockets are a mechanism to create a TCP like connection in the web stack, including the client and server communications layer. They are implemented as an extension to the HTTP protocol on supported web servers and clients.

### How WebSockets work?

WebSockets start with a normal HTTP connection which requests a connection "Upgrade" to the type of "websocket". After the handshake exchange, the connection remains open, allowing bidirectional messages similar to a normal network socket.

Since the underlying protocol is HTTP and the rest of the protocol is basically a long-living payload exchange, WebSockets inherit many characteristics such as:
- SSL/TLS support
- Middle distribution (proxies and load balancers)
- Rely on the same L3/L4 firewall rules as normal web traffic
- Supports HTTP headers such as cookies or compression settings

## The Application

I'll start defining what real-time data streaming application I will be building. The application will consist of a server-side component which will accept WebSocket connections and a HTML/JavaScript page w

So what application I'll be building an application consisting of a server-side service which will serve some static

We will start by defining the features of the real-time data streaming application that we will build. 



### The design brief



Firstly, I would like to host a static asset, which will be the client side application written in HTML and JavaScript. Which will need to be served as a standard HTTP request. Since this is basically a web application, it would be great to also register a "health" end-point to allow it to be monitored.

Next, I'll need to make the application handle WebSocket connections. In-line with the purpose of this project, I'll make then make the application do something that is considered real-time data streaming. It will first listen for and echo back any messages it receives, while in parallel triggering messages to be sent at random times.



Since I've been meaning to learn **Go**, why not use it for this projec server side component for this project. I'll be using [Draft](https://draft.sh/) to 



## The Web Server




### Serving static content

Let's create a basic web server that serves only a single page. In this case I will include a file aptly named `index.html` which will be served.

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

### Adding a health end-point

Now that 


## The Client


## Deployment





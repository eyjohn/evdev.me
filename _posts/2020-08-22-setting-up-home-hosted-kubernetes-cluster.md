---
layout: post
title: "Setting up Home-hosted Kubernetes Cluster"
date: 2020-08-22 08:52:41 +0100
categories: [kubernetes]
tags: [kubernetes, snap, microk8s, ingress, ingress-nginx, cert-manger, helm]
---

Since my GCP hosted cluster's free tier expired, I needed to find a new low-cost solution for hosting a generally-available Kubernetes cluster. I decided to host one at home, using some old equipment I had laying around backed by my internet connection. This post describes how I set this up with only minimal configuration but still with the capabilities of my previous cluster.

For more details on the needs for my Kubernetes cluster, please read my earlier post: [Setting up a Kubernetes Cluster for Development and Production]({% post_url 2019-10-27-setting-up-development-and-production-kubernetes-cluster %}#objectives).

## Objectives

Fundamentally I wanted to set up a single-node Kubernetes cluster, which should behave very similar to what you would expect from a cloud-hosted one. This includes:

- Be reachable externally and securely
- Provide HTTPS-based ingress
- Require minimum administration/maintenance

## Installing OS

Since I've been using Ubuntu for almost a decade, I decided to stick with installing a basic [ubuntu-server](https://ubuntu.com/download/server) image (20.04 LTS) via USB. I did not select any additional packages to be installed.

## Installing Kubernetes

There are several options for how to install Kubernetes, such as [minikube](https://kubernetes.io/docs/tasks/tools/install-minikube/), [microk8s](https://microk8s.io/) or even manually, I decided to give **microk8s** a go since it was recommended for Ubuntu installs.

### What is microk8s?

Similarly to minikube, microk8s is a lightweight Kubernetes cluster with a small ecosystem of utilities and addons. It simplifies the installation of Kubernetes on top of an existing Linux distribution. It even ships with `kubectl` and an extension can provide `helm`.

### Installing microk8s

Microk8s is distributed through `snap` and can be installed with:

```sh
sudo apt update && sudo apt install snapd # if you don't have snap
sudo snap install microk8s --classic
```

To enable administration without sudo, simply run:

```sh
sudo usermod -a -G microk8s $USER
```

Install useful microk8s extensions:
```sh
sudo microk8s enable dns dashboard rbac storage
```

### Accessing microk8s via kubectl

You can either administer the cluster directly on the host by using the microk8 wrappers, or simply get the kubectl config to use remotely.

#### Local Access

```sh
microk8s kubectl get nodes
```

#### Remote Access

Generate and retrieve the kubectl config using
```sh
microk8s config > kubectl.config # download this to your local device
```

## Setting up the cluster for external connectivity

### Configure external access (port forwarding)

If you're behind a NAT router like me, you will first need to configure port-forwarding from your router to the Kubernetes host. In my case, I preconfigured ports 80 and 443 for forwarding web traffic.

### Install ingress-nginx

I intend to use [ingress-nginx](https://kubernetes.github.io/ingress-nginx/) to accept and dispatch traffic to pods within my cluster. Nginx will need to accept inbound connections on the host port (80 and 443 for me).

`ingress-nginx/values.yaml`
```yaml
controller:
  kind: DaemonSet
  hostPort:
    enabled: true
  service:
    type: NodePort
```

To install ingress-nginx
```sh
kubectl create namespace ingress-nginx
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install \
  ingress-nginx ingress-nginx/ingress-nginx \
  -n ingress-nginx \
  -f ingress-nginx/values.yaml
```

*NOTE: I did initially try and use the ingress addon provided with microk8s, but I never managed to get it working. Given that the [documentation](https://microk8s.io/docs/addon-ingress) was rather limited, I went back to using ingress-nginx.*

### Install cert-manager

Since I'll be using SSL to provide secure access, I'll need a certificate manager installed on my cluster which will allow me to automatically acquire certificates from [Let's Encrypt](https://letsencrypt.org/). The popular [jetstack cert-manager](https://cert-manager.io/docs/) can be installed by running:

```sh
kubectl create namespace cert-manager
helm repo add jetstack https://charts.jetstack.io
helm repo update
helm install \
  cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --version v0.16.1 \
  --set installCRDs=true
```

This should be followed up by installing a certificate issuer, for example as described in [Configure Let's Encrypt Issuer](https://cert-manager.io/docs/tutorials/acme/ingress/#step-6-configure-let-s-encrypt-issuer).

### Exposing kube-apiserver publicly

The remote kubectl config above will work as long as the node can be reached directly or possibly by adding another port-forward. However, I prefer to expose it as a dedicated end-point on my ingress with a publicly valid SSL certificate. To achieve this I've applied the following ingress configuration:

`kubernetes-ingress.yaml`
```yaml
apiVersion: networking.k8s.io/v1beta1
kind: Ingress
metadata:
  name: kubernetes
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/backend-protocol: "HTTPS"
spec:
  rules:
  - host: kubernetes.my.domain.name
    http:
      paths:
      - path: /
        backend:
          serviceName: kubernetes
          servicePort: 443
  tls:
  - hosts:
    - kubernetes.my.domain.name
    secretName: kubernetes-tls
```

I can now update my kubectl configuration to hit this end-point directly without any extra port-forwards or custom certificate authority entries.

## Conclusion

At this point, my home-hosted cluster appears and behaves like my previous cloud-hosted one with the caveat of being on a slower internet connection and being in a non-scalable single-node configuration. I then continued to set up my baseline applications including [brigade](https://brigade.sh), following the same [steps]({% post_url 2019-10-27-setting-up-development-and-production-kubernetes-cluster %}#setting-up-brigade) as I did in my previous cluster. I found that microk8s, was a very easy way to get Kubernetes up and running, although I did struggle with the ingress addon initially, overall it was a fairly straight forward to set up.

You can find a dense summary of this set-up process as well as most of my configuration on my cluster set-up git project: [homelab](https://github.com/eyjohn/homelab).
---
layout: post
title:  "Setting up a Kubernetes Cluster for Development and Production"
date:   2019-08-04 09:31:19 +0100
categories: [kubernetes]
tags: [kubernetes, ingress, nginx-ingress, cert-manger, brigade]
---

For my upcoming projects, I wanted to use a container based platform to facilitate both my development and production hosting needs. This post will walk through how I configured a Kubernetes cluster from Google's cloud platform for this purpose whilst still keeping costs low.

Why [Kubernetes](https://kubernetes.io/)?
- It's popular and is being actively developed
- Great tooling: `helm`, `draft`, `minikube`
- Based on containerization
- Supported by major cloud vendors
- Everything is a resource *(more on this later)*

## Objectives

Given that my Kubernetes cluster was intended for hosting hobby projects, I had somewhat specialised needs:

- Keep costs low (milk the free tier!)
- Host production apps
- Hosted development workflow: CI, CD, GitHub App
- Somewhat available (redundancy with at least 1 backup node)

Since my profile isn't the priority for cloud providers (especially the costs part), I required a more complex setup than your average Kubernetes setup.

## Background

I expect that you already have a basic understanding of [Kubernetes](https://kubernetes.io/) and containers in general. Here is a quick introduction of the additional tools that I plan on using.

### Helm for Package Management

[Helm](https://helm.sh/) is a great tool for managing packages and configuration through the use of *charts*. Related packages are assembled in charts which then expose a single set of configurable parameters. I can then simply maintain a list of the charts I wish to install and their configurations.

### Brigade for Continuous Integration

[Brigade](https://brigade.sh/) is an event driven scripting framework designed to work for containers which is well suited to continuous integration. It comes with great support for GitHub integration.

## Setting up a cluster

Google's cloud platform has great tooling which makes setting up a Kubernetes a simple command. After installing and authenticating with the tools, all I had to do is:

```sh
gcloud container clusters create evkube --num-nodes 2 --disk-size 15 -m g1-small
```

*I went with the g1-small (non free tier) configuration as I found that the free tier f1-micro with only 600 MB ram was not sufficient for my needs. The disk size totalling in 30 GB however was included in the free tier.*

Once setup, you can configure `kubectl` to use your new cluster by:

```sh
gcloud container clusters get-credentials evkube
# Then you can run:
kubectl get all
```





A basic understanding of [Kubernetes](https://kubernetes.io/) is required




I decided to use [Kubernetes](https://kubernetes.io/) due to the popularity, features, tooling and great support from cloud vendors. Kuberenetes is advertised as "an open-source system for automating deployment, scaling, and management of containerized applications" however as this post will show, it is much more than that. In short, I found that it provides a platform to manage *resources* both internal and external including from containers, storage, load-balancers, routing configuration and certificates. Users simply configure what resources their applications need and Kubernetes does the rest.

## Objectives


Given that my Kubernetes cluster was intended for hosting hobby projects, I had somewhat specialised needs which required a bit more complex setup as cloud providers don't really prioritise my type of user.

### Hosted Production Cluster

Not all hobby projects come with the requirement that they are always available, but in my case I very much intend on my projects to run even when I'm not using them myself. I also preferred to use an external hosting provider rather than setup a container hosting environment at my home.

### Low Cost

Whilst I know hobbies can get quite expensive, I didn't want to throw money away if I didn't have to. Therefore I decided to go with [Google Cloud Platform](https://cloud.google.com/) which not only offers a great free trial teir (for 12 month), but also provides some "always-free" resources.

However, Google's pricing can quickly grow as you start using more features (e.g. Load Balancers) which can sometimes be greater than the cost of the cluster. Therefore I will tend to prefer host as many resources as I can on the Kubernetes cluster itself to minimise costs.

### Development Cluster

On the theme of keeping costs low, ideally I would use the same cluster both for my development and production hosting needs. In my case I am not too worried about keeping the envionments isolated as Kubernetes makes it quite easy to keep the containers seperate using namespaces and security is less of a concern.

For development tooling and integration, I plan on using [Brigade](https://brigade.sh/) for my continuous integration and deployment. It also comes with GitHub integration which requires it to be hosted and reachable by GitHub.

### Highly Available (somewhat)

Whilst I don't plan on running any mission critical applications, I don't want to worry about the cluster going down and for me to have to recover it (or lose any data on it). I'll therefore prefer a multi-instance setup with fairly responsive (minutes) fail-over.

---

## Outline

- background:
  - K8s
  - Brigade
  - Google CP

- Objectives
  - Cheap (as free as possible)
  - Multi-instance ideally
  - Development needs
  - PRoduction applications





## NOTES:
## Needs (Objecti)

- A cheap cluster
  - no expensive load balancers
  - free tier to the max
- Multi-instance (some avail)
  - nodes
  - somewhat highly available
- Development
  - integration with brigade?
- Production applications
  - all my projects will be hosted here


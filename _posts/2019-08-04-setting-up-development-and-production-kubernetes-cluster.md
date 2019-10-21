---
layout: post
title:  "Setting up a Kubernetes Cluster for Development and Production"
date:   2019-08-04 09:31:19 +0100
categories: [kubernetes]
tags: [kubernetes, ingress, nginx-ingress, cert-manger, brigade]
---

For my upcoming projects, I wanted to use a container based platform both for my development workflow and production hosting needs. This post describes how I configured a Kubernetes cluster from Google's cloud platform at a reasonable cost.

Why [Kubernetes](https://kubernetes.io/)?
- It's popular and is being actively developed
- Great tooling: `helm`, `draft`, `minikube`
- Based on containerization
- Supported by major cloud vendors
- Everything is a resource *(more on this later)*

## Objectives

Given that my Kubernetes cluster was intended for "hobby" projects, I had somewhat specialised needs:

- Keep costs low (milk the free tier!)
- Host production apps
- Hosted development workflow: CI, CD, GitHub App
- Somewhat available (redundancy with at least 1 backup node)

Since this profile isn't the priority for cloud providers (especially the low-cost part), I often opted to self-host my infrastructure, sacrificing simplicity to keep costs low.

## Background

I expect that you already have a basic understanding of [Kubernetes](https://kubernetes.io/) and containers in general. Here is a quick introduction of the additional tools that I plan on using.

### Helm for Package Management

[Helm](https://helm.sh/) is a great tool for managing packages and configuration through the use of *charts*. Related packages are assembled in charts which then expose a single set of configurable parameters. I can then simply maintain a list of the charts I wish to install and their configurations.

### Brigade for Continuous Integration

[Brigade](https://brigade.sh/) is an event driven scripting framework designed to work for containers which is well suited to continuous integration. It comes with great support for GitHub integration.

## Setting up a cluster

Google's cloud platform has great tooling which makes setting up a Kubernetes a simple command. After installing and authenticating with the tools, all I had to do is:

```sh
gcloud container clusters create evkube --num-nodes 2 --disk-size 15 -m g1-small --no-enable-cloud-logging --no-enable-cloud-monitoring
```

*I went with the g1-small (non free tier) configuration as the free tier f1-micro with only 600 MB ram was not sufficient for my needs, even with the g1-small I had to disable some observability features to support my workload.*

Once setup, you can configure `kubectl` to use your new cluster by:

```sh
gcloud container clusters get-credentials evkube
# Then you can run:
kubectl describe nodes
```

And that's you have a working cluster, let's make it do something!

## Setting up Helm

Helm is required for most of the next components that I need to install. 

NOTE: Before installing helm, you may need to configure RBAC, see the documentation [Role-based Access Control Documentation](https://github.com/helm/helm/blob/master/docs/rbac.md).

To install helm simply:

```sh
helm init --service-account tiller
```

## Installing self-hosted infrastructure

Why? Kubernetes treats everything as a **resource**: load balancer, storage provisioner or certificate managers. Your cloud vendor will likely pre-configure your cluster to already use their own products which are generally very easy to use. However, if you're trying to keep costs low and don't mind a bit of complexity, then you can probably setup everything you need yourself.

### Load Balancers/Ingress

I chose to use [nginx-ingress](https://kubernetes.github.io/ingress-nginx/) to handle and route incoming connections on a publicly accessible `hostPort` (configured on my firewall) rather than the cloud provider's load balancers. To set this up:

#### 1. Expose the host port on your firewall

```sh
gcloud compute firewall-rules create nginx-ingress --allow tcp:80,tcp:443
```

Whilst not covered here, you will probably want to setup DNS to point to the IP addresses which you can find by running:

```sh
kubectl get nodes -o jsonpath='{ $.items[*].status.addresses[?(@.type=="ExternalIP")].address }'
```

#### 2. Configure nginx-ingress

`values.yaml`
```yaml
controller:
  kind: DaemonSet      # Run on every node
  daemonset:
    useHostPort: true  # Use a port on host interface
  service:
    type: NodePort     # Don't use LoadBalancer for services
```

#### 3. Install nginx-ingress

```sh
helm install -n nginx-ingress --namespace nginx-ingress stable/nginx-ingress -f values.yaml
```



### Certificate Manager

Now that we can accept HTTP connections, lets setup a certificate manager to create certificates for HTTPS. I decided to use the [Jetstack Cert Manager](https://github.com/jetstack/cert-manager) configured to use [Let's Encrypt](https://letsencrypt.org/) certificates (which are free). To install and configure the certificate manager:

#### 1. Add certificate manager resource definitions

```sh
kubectl apply --validate=false -f https://raw.githubusercontent.com/jetstack/cert-manager/release-0.11/deploy/manifests/00-crds.yaml
```

#### 2. Add an issuer

**NOTE: Please using a staging issuer first before attempting to use a production one to avoid getting banned/throttled by Let's Encrypt by accident!**

Create the following configuration file (and replace your email).

`production-issuer.yaml`
```yaml
apiVersion: certmanager.k8s.io/v1alpha1
kind: ClusterIssuer # This issuer can be used across namespaces on this cluster
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: MY.EMAIL@MY.DOMAIN
    privateKeySecretRef:
      name: letsencrypt-prod
    http01: {}
```

Then install this issuer on your cluster.

```sh
kubectl apply -f production-issuer.yaml
```

#### 3. Install cert-manager

```sh
helm repo add jetstack https://charts.jetstack.io
helm repo update
helm install -n cert-manager --namespace cert-manager jetstack/cert-manager
```

For a complete installation guide, please see: [Cert Manager - Installing on Kubernetes](https://docs.cert-manager.io/en/latest/getting-started/install/kubernetes.html).


### Storage Provisioner

I chose the NFS storage provisioner, as it was easy to set up and provides the `ReadWriteMany` mode which will be required by Brigade.

```sh
helm install -n nfs-server-provisioner --namespace nfs-server-provisioner  stable/nfs-server-provisioner
```

## Setting up Brigade

Setting up brigade with GitHub integration is a fairly involved effort and not great for first-time users. This post does not cover the process of registring a GitHub app which is covered in more detail on the official [brigade-github-app documentation](https://github.com/brigadecore/brigade-github-app).





---





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


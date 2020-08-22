---
layout: post
title:  "Setting up a Kubernetes Cluster for Development and Production"
date:   2019-10-27 22:18:00 +0000
categories: [kubernetes]
tags: [kubernetes, ingress, nginx-ingress, cert-manger, brigade, helm]
---

For my upcoming projects, I wanted to use a container-based platform both for my development workflow and production hosting needs. This post describes how I configured a Kubernetes cluster from Google's cloud platform at a reasonable cost.

Why [Kubernetes](https://kubernetes.io/)?
- It's popular and is being actively developed
- Great tooling: `helm`, `draft`, `brigade`, `minikube`
- Based on containerization
- Supported by major cloud vendors
- Everything is a resource *(more on this later)*

## Objectives

Given that my Kubernetes cluster was intended for "hobby" projects, I had somewhat specialised needs:

- Keep costs low (milk the free tier!)
- Host production apps
- Hosted development workflow: CI, CD, GitHub integration
- Somewhat available (redundancy with at least 1 backup node)

Since this profile isn't the priority for cloud providers (especially the low-cost part), I often opted to self-host my infrastructure, sacrificing simplicity to keep costs low.

## Background

I expect that you already have a basic understanding of [Kubernetes](https://kubernetes.io/) and containers in general. Here is a quick introduction of the additional tools that I plan on using.

### Helm for Package Management

[Helm](https://helm.sh/) is a great tool for managing packages and configuration through the use of *charts*. Related packages are assembled in charts which then expose a single set of configurable parameters. I can then simply maintain a list of the charts I wish to install and their configurations.

### Brigade for Continuous Integration

[Brigade](https://brigade.sh/) is an event-driven scripting framework designed to work for containers which is well suited to continuous integration. It comes with great support for GitHub integration.

## Setting up a cluster

Google's cloud platform has great tooling which makes setting up a Kubernetes cluster a simple command. After installing and authenticating with the tools, all I had to do is:

```sh
gcloud container clusters create evkube --num-nodes 2 --disk-size 15 -m g1-small --no-enable-cloud-logging --no-enable-cloud-monitoring
```

*I went with the g1-small (non-free tier) configuration as the free tier f1-micro with only 600 MB ram was not sufficient for my needs, even with the g1-small I had to disable some observability features to support my workload.*

Once set up, you can configure `kubectl` to use your new cluster by:

```sh
gcloud container clusters get-credentials evkube
# Then you can run:
kubectl describe nodes
```

And that's it, you have a working cluster, let's make it do something!

## Setting up Helm

Helm is required for all of the next components that I need to install. 

*NOTE: Before installing helm, you may need to configure RBAC, see the documentation [Role-based Access Control Documentation](https://github.com/helm/helm/blob/master/docs/rbac.md).*

To install helm simply:

```sh
helm init --service-account tiller
```

## Installing self-hosted infrastructure

Why? Kubernetes treats everything as a **resource**: load balancer, storage or certificates. Your cloud vendor will likely pre-configure your cluster to already use their own products which are generally very easy to use. However, if you're trying to keep costs low and don't mind a bit of complexity, then you can probably set up everything you need yourself.

### Load Balancers/Ingress

I chose to use [nginx-ingress](https://kubernetes.github.io/ingress-nginx/) to handle and route incoming connections on a publicly accessible `hostPort` (configured on my firewall) rather than the cloud provider's load balancers. To set this up:

#### 1. Expose the host port on your firewall

```sh
gcloud compute firewall-rules create nginx-ingress --allow tcp:80,tcp:443
```

Whilst not covered here, you will probably want to set up DNS to point to the IP addresses which you can find by running:

```sh
kubectl get nodes -o jsonpath='{ $.items[*].status.addresses[?(@.type=="ExternalIP")].address }'
```

#### 2. Configure nginx-ingress

`nginx-ingress/values.yaml`

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
helm install -n nginx-ingress --namespace nginx-ingress stable/nginx-ingress -f nginx-ingress/values.yaml
```

### Certificate Manager

Now that we can accept HTTP connections, lets set up a certificate manager to create certificates for HTTPS. I decided to use the [Jetstack Cert Manager](https://github.com/jetstack/cert-manager) configured to use [Let's Encrypt](https://letsencrypt.org/) certificates (which are free). To install and configure the certificate manager:

#### 1. Add certificate manager resource definitions

```sh
kubectl apply --validate=false -f https://raw.githubusercontent.com/jetstack/cert-manager/release-0.11/deploy/manifests/00-crds.yaml
```

#### 2. Add an issuer

**NOTE: Please using a staging issuer first before attempting to use a production one to avoid getting banned/throttled by Let's Encrypt by accident!**

Create the following configuration file (and replace your email).

`cert-manager/production-issuer.yaml`
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
kubectl apply -f cert-manager/production-issuer.yaml
```

#### 3. Install cert-manager

```sh
helm repo add jetstack https://charts.jetstack.io
helm repo update
helm install -n cert-manager --namespace cert-manager jetstack/cert-manager
```

For a complete installation guide, please see [Cert Manager - Installing on Kubernetes](https://docs.cert-manager.io/en/latest/getting-started/install/kubernetes.html).

### Storage Provisioner

I chose the NFS storage provisioner, as it was easy to set up and provides the `ReadWriteMany` mode which will be required by Brigade.

```sh
helm install -n nfs-server-provisioner --namespace nfs-server-provisioner  stable/nfs-server-provisioner
```

## Setting up Brigade

This post describes how to install Brigade with GitHub integration which requires you to host a web service that receives events for configured GitHub hooks. GitHub app registration is not covered but you can find more detail about this on the official [brigade-github-app documentation](https://github.com/brigadecore/brigade-github-app). After creating the GitHub app, you can install Brigade by following these steps:

### 1. Configure Brigade

Create the following configuration file and fill in the details of your GitHub app and domain.

`brigade/values.yaml`

```yaml
brigade-github-app:
  enabled: true
  service:
    type: NodePort
  ingress:
    hosts:
      - DOMAIN_USED_BY_THIS_BRIGADE_GITHUB_APP
    annotations:
      # Use nginx-ingress for routing
      kubernetes.io/ingress.class: "nginx"
      # Use cert-manager issuer to create a certificate
      certmanager.k8s.io/cluster-issuer: "letsencrypt-prod"
      certmanager.k8s.io/acme-challenge-type: http01
    tls:
    - hosts:
      - DOMAIN_USED_BY_THIS_BRIGADE_GITHUB_APP
      secretName: SECRET_NAME_FOR_THIS_CERTIFICATE
  github:
    # The GitHub app id and credentials
    appID: 36087
    key: MY_SUPER_SECRET_KEY
worker:
  # Use nfs-server-provisioner for provisioning storage
  defaultBuildStorageClass: nfs
  defaultCacheStorageClass: nfs
```

### 2. Install Brigade

```sh
helm repo add brigade https://brigadecore.github.io/charts
helm repo update
helm install -n brigade brigade/brigade --namespace=brigade -f brigade/values.yaml
```

### 3. Verify installation

Once Brigade is installed, you can use the [brig](https://docs.brigade.sh/topics/brig/) CLI to interact with your Brigade instance.

*NOTE: Since Brigade was installed to a specific namespace, you will need to set this when using `brig`.*

To test Brigade, we can bring up the dashboard with:

```sh
export BRIGADE_NAMESPACE=brigade
brig dashboard
```

### 4. Verify GitHub hooks are working

Firstly verify that your HTTP endpoint is reachable and you do not receive any errors. You can check the following URL: `https://$domain_used_by_this_github_app/healthz`

You can also check your app in GitHub under: GitHub Apps -> Edit -> Advanced -> Recent Deliveries. This should now start showing any hooks that were fired and their result.

## Conclusion

I'll be honest that the journey of learning about these concepts for the first time while trying to use them was a challenge. Furthermore, I had to figure out how to debug build failures which I eventually figured out were a result from insufficient resources on both my micro and small instances leading me to finally using small instances with monitoring disabled. However, the journey of setting up all these components helped me understand just what Kubernetes is really about.

Now that I have both my hosting and development workflow set up, I can start putting it to use. I've since been able to create a test project and have set up the generation and deployment of this website which I will explore in more detail in an upcoming post.

You can find a dense summary of this setup process as well as most of my configuration on my cluster setup git project: [evkube](https://github.com/eyjohn/evkube).
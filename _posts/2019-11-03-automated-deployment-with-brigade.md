---
layout: post
title:  "Automated deployments of this site with Brigade"
date:   2019-11-03 19:23:59 +00:00
categories: [docker, kubernetes, continuous-deployment]
tags: [brigade, jekyll, website, docker, kubernetes]
---

With the site up and running, I wanted to make my life easier by setting up an automated deployment pipeline powered by Brigade. Brigade is ideal for an event-driven workflow (such as on push) which will form the basis of my continuous deployment for my projects. In this post, I will cover how to create a brigade project and configure it to deploy this website automatically.

## Background

Before getting into the setup, let's cover how this website is built and deployed today, as well as a recap of my Brigade setup.

### Building this website

This website is built using Jekyll, which is basically the process of running `jekyll build` to convert the source files (found on [evdev.me GitHub repository](https://github.com/eyjohn/evdev.me)) into static assets that can be deployed into any web hosting provider. You cna find more details on how this website is built on my earlier post [Making this website with Jekyll]({% post_url 2019-07-07-making-this-website-with-jekyll %}). 

### Hosting and Deployment

I use [Google's Firebase Hosting](https://firebase.google.com/products/hosting/) for this website as it offers secure (HTTPS) web-hosting, caches your content globally for faster access and most importantly, it comes with a free tier that's more than enough for me. Although this post uses Firebase CLI for deployment, using an alternative hosting, such as uploading files over FTP/SCP should be fairly similar. It's worth noting that this type of website can easily be hosted on GitHub pages, but I chose to use my own hosting as I wanted to set up my own build and deployment process.

### Brigade

[Brigade](https://brigade.sh/) is an event driven scripting framework designed to work for containers which is well suited to continuous integration or to initiate continuous deployment. This post uses the Brigade instance configured with GitHub integration as set up in my earlier post [Setting up a Kubernetes Cluster for Development and Production]({% post_url 2019-10-27-setting-up-development-and-production-kubernetes-cluster %})

## Continuous integration workflow

For this project I decided to use a simple workflow of building and deploying my website upon every push to some protected branches:

- **master** - main website
- **staging** - staging version for manually validating changes

Brigade lets you define more complex workflows such as PR validation by running test suites or other tools. However, these are unnecessary for this type of project and I only really need brigade to trigger my deployment pipeline.

## Setting up Brigade Project

Brigade provides the CLI tool [brig](https://docs.brigade.sh/topics/brig/) which makes it very easy to create a project:

### 1. Create the project

```sh
$ brig project create
? VCS or no-VCS project? VCS
? Project Name eyjohn/evdev.me
? Full repository name github.com/eyjohn/evdev.me
? Clone URL (https://github.com/your/repo.git) https://github.com/eyjohn/evdev.me.git
? Add secrets? Yes --- SEE BELOW ---
...
? Where should the project's shared secret come from? Leave undefined
? Configure GitHub Access? No
? Configure advanced options No
Project ID: brigade-2809670f5c85efb78f808c7446e312340c1893136c869db51aa557
```

You can now verify that your project has been created by running:

```sh
$ brig project list
NAME                 	ID                                                            	REPO                            
eyjohn/evdev.me      	brigade-2809670f5c85efb78f808c7446e312340c1893136c869db51aa557	github.com/eyjohn/evdev.me  
```

Or alternatively by launching the Brigade dashboard:

```sh
$ brig dashboard
2019/11/05 22:32:41 Connecting to kashti at http://localhost:8081...
2019/11/05 22:32:42 Connected! When you are finished with this session, enter CTRL+C.
```

{:refdef: style="text-align: center;"}
![Screenshot of fresh project in Brigade dashboard]({{ "/assets/posts/automated-deployment-with-brigade/brigade_new_project.png" | relative_url }})
{: refdef}



### 2. Configure secrets

You can define secrets that would be available to your `brigade.js` script, allowing you to store sensitive credentials without having to place them in the repo or into the containers.

In this case, I plan to store my Firebase authentication credentials, but these could likewise be used to store an SSH key or FTP credentials.

The easiest way to do this is at the time of the creation of the project.

- creating project
  - Brig CLI
  - Secrets...
- enabling GitHub app

## Creating a build Job

## Creating a deployment Job

## Sharing build artefacts

## Sharing cache

## Setting up staging deployment

## Conclusion

Using Brigade was a big change to what I'm normally used to with Jenkins, which normally requires me to spend more time configuring my Jenkins instance and development environment on any nodes. Brigade on the other hand has very few configuration options and instead relies on users to express their jobs in a single `brigade.js` configuration file, backed by a deployment environment consisting only of containers.

This required a huge mindset shift that emphasises the use of containers to execute the build, test and deployment process. This eliminates the need for a large or complex development or testing environment and encourages the use of isolated containers for each job. Furthermore, this makes it easier to run tools that might not be compatible with each other or to use new tools as everything is isolated.

After getting to grips with the Brigade fundamentals (jobs, storage/cache, secrets) I found it very intuitive to express the different jobs required for my project. When combined with GitHub integration, it can be used to create a range of workflows without much difficulty. Finally, with all the resources of my Kubernetes cluster, Brigade can start the containers whenever or wherever it needs. This definitely seems like the next step in the evolution of continuous integration and I'm eager to try use it again for my future projects! 
---
layout: post
title:  "Automated deployments of this site with Brigade"
date:   2019-07-08 11:11:11 +0100
categories: [docker, kubernetes, continuous-deployment]
tags: [brigade, jekyll, website, docker, kubernetes]
---

With the site up and running, I wanted to make my life easier by setting up an automated deployment pipeline powered by [Brigade](https://brigade.sh/). Brigade is ideal for an event-driven workflow (such as commits to master) which will form the basis of my continuous deployment for my projects.




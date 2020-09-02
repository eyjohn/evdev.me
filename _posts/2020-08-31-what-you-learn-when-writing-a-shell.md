---
layout: post
title: "What you learn by writing a shell?"
date: 2020-08-31 20:49:25 +0100
categories: [c++]
tags: [c++, shell, bash, cmake]
---

A Google engineer once told me about how they asked a less experienced colleague to learn about low-level system calls by trying to write a simple shell. Intrigued by this learning opportunity, I decided to have a go myself!

## Why is this a good learning exercise?

Given that most modern software development  
focuses on developing applications that are "somehow" executed



## What is a Shell?

The first question that came to mind was actually defining what a shell is? So many of us take it for granted that our favourite shell (usually bash) is just how we interact with the system. But what does it take to interact with the system, and what are the minimum required features?

[Wikipedia](https://en.wikipedia.org/wiki/Shell_(computing)) defines a shell as:

> In computing, a shell is a user interface for access to an operating system's services. In general, operating system shells use either a command-line interface (CLI) or graphical user interface (GUI), depending on a computer's role and particular operation. It is named a shell because it is the outermost layer around the operating system.

*NOTE: To keep things simple, we'll constrain this definition to a command-line interface for a Unix (like) operating system.*

Another way of phrasing this is that: a shell allows a user to interact with the underlying system. Consider an early iteration of a physical terminal, which provides a user with a command-line where they can input commands and observe the output. One key feature of a shell is that it allows a user to execute applications, this allows many operations to be delegated to other executables (e.g. `cat`, `vim`, `ls`).

What about things like: job control, input/output redirection, autocomplete, variables, logical expressions, batch execution. While these are all great features, they are ultimately convenience features that do not interact with the underlying system (mostly), and are out of the scope of this exercise.

## Why

feature necessary to interact with a system

A lot of the higher-level functionality can actually be performed


---

## Objectives

Fundamentally I wanted to set up a single-node Kubernetes cluster, which should behave very similar to what you would expect from a cloud-hosted one. This includes:

- Be reachable externally and securely
- Provide HTTPS-based ingress
- Require minimum administration/maintenance

## Conclusion

I learnt something bro?
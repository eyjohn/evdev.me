---
layout: post
title:  "Automated deployments of this site with Brigade"
date:   2019-11-09 10:00:47 +00:00
categories: [docker, kubernetes, continuous-deployment]
tags: [brigade, jekyll, website, docker, kubernetes]
---

With the site up and running, I wanted to make my life easier by setting up an automated deployment pipeline powered by Brigade. Brigade is ideal for an event-driven workflow (such as on push) which will form the basis of my continuous deployment for my projects. In this post, I will cover how to create a brigade project and configure it to deploy this website automatically.

## Background

Before getting into the setup, let's cover how this website is built and deployed today, as well as a recap of my Brigade setup.

### Building this website

This website is built using Jekyll, which is essentially the process of running `jekyll build` to convert the source files (found on [evdev.me GitHub repository](https://github.com/eyjohn/evdev.me)) into static assets that can be deployed into any web hosting provider. You can find more details on how this website is built on my earlier post [Making this website with Jekyll]({% post_url 2019-07-07-making-this-website-with-jekyll %}).

### Hosting and Deployment

I use [Google's Firebase Hosting](https://firebase.google.com/products/hosting/) for this website as it offers secure (HTTPS) web-hosting, caches your content globally for faster access and most importantly, it comes with a free tier that's more than enough for me. Although this post uses Firebase CLI for deployment, using an alternative deployment hosting solution, such as uploading files over FTP/SCP should be fairly similar. It's worth noting that this type of website can easily be hosted on GitHub pages, but I chose to set up the deployment and hosting myself as a learning exercise.

### Brigade

[Brigade](https://brigade.sh/) is an event-driven scripting framework designed to work with containers and is well suited to continuous integration or to initiate continuous deployment. This post uses the Brigade instance configured with GitHub integration as set up in my earlier post [Setting up a Kubernetes Cluster for Development and Production]({% post_url 2019-10-27-setting-up-development-and-production-kubernetes-cluster %}).

## Continuous integration workflow

For this project I decided to use a simple workflow of building and deploying my website upon every push to some predetermined branches:

- **master** - main website
- **staging** - staging version for manually previewing changes

Brigade lets you define more complex workflows such as pull request validation by running test suites or other tools. However, these are unnecessary for this type of project and I only really need Brigade to trigger my deployment pipeline.

## Setting up Brigade Project

Brigade provides the CLI tool [brig](https://docs.brigade.sh/topics/brig/) which makes it very easy to create a project:

### 1. Create the project

```text
$ brig project create
? VCS or no-VCS project? VCS
? Project Name eyjohn/evdev.me
? Full repository name github.com/eyjohn/evdev.me
? Clone URL (https://github.com/your/repo.git) https://github.com/eyjohn/evdev.me.git
? Add secrets? Yes --- SEE BELOW ---
...
? Where should the project's shared secret come from? Specify my own
? Shared Secret **********
? Configure GitHub Access? No
? Configure advanced options No
Project ID: brigade-2809670f5c85efb78f808c7446e312340c1893136c869db51aa557
```

You can now verify that your project has been created by running:

```sh
$ brig project list
NAME                  ID                                                              REPO                            
eyjohn/evdev.me       brigade-2809670f5c85efb78f808c7446e312340c1893136c869db51aa557  github.com/eyjohn/evdev.me  
```

Or alternatively by launching the "Kashti" dashboard provided by Brigade:

```sh
$ brig dashboard
2019/11/05 22:32:41 Connecting to kashti at http://localhost:8081...
2019/11/05 22:32:42 Connected! When you are finished with this session, enter CTRL+C.
```

{:refdef: style="text-align: center;"}
![Screenshot of fresh project in Kashti]({{ "/assets/posts/automated-deployment-with-brigade/brigade_new_project.png" | relative_url }})
{: refdef}

### 2. Configure secrets

You can define secrets that would be available to your `brigade.js` script, allowing you to store sensitive credentials without having to place them in the repo or the containers.

In this case, I plan to store my Firebase authentication credentials, but these could likewise be used to store an SSH key or FTP credentials.

The easiest way to do this is at the time of the creation of the project.

### 3. Enable GitHub app access

To allow the GitHub app used by Brigade to access the repository, it will need to be configured in [GitHub Apps](https://github.com/settings/apps) -> Edit -> Install App.

{:refdef: style="text-align: center;"}
![Screenshot of GitHub app installation for project]({{ "/assets/posts/automated-deployment-with-brigade/github_add_brigade.png" | relative_url }})
{: refdef}

## Creating jobs

With the project set up, let's start adding some jobs.

### 1. Creating a test job

First, let's create a simple job to test that simply prints the branch:

`brigade.js`
```js
const { events, Job } = require("brigadier");
events.on("push", (event, project) => {
  const branch = event.revision.ref;
  const job = new Job("test-job", "alpine", [`echo ${branch}`]);
  job.run();
});
```

After pushing we can verify that it's working by using the Kashti dashboard:

{:refdef: style="text-align: center;"}
![Screenshot of test job build in Kashti]({{ "/assets/posts/automated-deployment-with-brigade/test_job.png" | relative_url }})
{: refdef}

### 2. Creating a build job

To build this website, Brigade will need to pull the source code, run the `jekyll build` command and finally output the built website for the deployment step.

```js
function createBuildJob(event, project) {
  var buildJob = new Job("build-job");

  buildJob.image = "jekyll/jekyll";

  buildJob.tasks = [
    "cd /src",
    "jekyll build",
  ];

  buildJob.streamLogs = true;
  return buildJob;
}
```

To export the build artefacts to the deployment job, the build artefacts will need to be copied to a job **storage** which is shared across jobs and can be configured using:

```js
  buildJob.tasks = [
    "cd /src",
    "jekyll build",
    "cp -r firebase.json _site /build" // firebase.json required for deployment
  ];
  buildJob.storage.enabled = true;
  buildJob.storage.path = '/build';
```

Since my Jekyll configuration requires some modules to be installed, it would be great to not have to install them every time I run the build and re-use them from the previous builds. This can be configured using the job **cache** which is shared between builds for the same job and can be configured using:

```js
  buildJob.cache.size = '100Mi';
  buildJob.cache.enabled = true;
  buildJob.cache.path = '/usr/local/bundle'; // Jekyll image cache location
```

### 3. Creating a deployment job

To deploy this website to firebase, I'll use an image with the firebase CLI tool pre-installed. Since I plan on having two different deployments: staging and production, I will make the deployment destination a configurable parameter. I will be using project secrets to store the credentials for my deployment destinations. This job will need to pull in the build artefacts from earlier and deploy them.

```js
function createDeployJob(event, project, staging) {
    const firebaseProject = staging
    ? project.secrets.FIREBASE_PROJECT_STAGING
    : project.secrets.FIREBASE_PROJECT_PRODUCTION;
  var deployJob = new Job("deploy", "andreysenov/firebase-tools", [
    'cd /build',
    `firebase deploy --project ${firebaseProject} --token ${project.secrets.FIREBASE_TOKEN}`
  ]);
  deployJob.storage.enabled = true;
  deployJob.storage.path = '/build';
  deployJob.streamLogs = true;
  return deployJob;
}
```
### 4. Putting it all together

Finally, let's hook up these jobs to the push event. For my workflow, I will need to detect the branch of the push to determine whether the build should be deployed to the production or staging destination.

```js
async function runBuildAndDeploy(event, project) {
  const buildJob = createBuildJob(event, project);

  var staging;
  if (event.revision.ref == "refs/heads/master") {
    staging = false;
  } else if (event.revision.ref == "refs/heads/staging") {
    staging = true;
  } else {
    return; // Nothing to do for other branches
  }

  const deployJob = createDeployJob(event, project, staging);

  await buildJob.run();
  await deployJob.run();
}
events.on("push", runBuildAndDeploy);
```

### 5. Testing the pipeline

By pushing to the `staging` branch I can now test that both jobs are working.

{:refdef: style="text-align: center;"}
![Screenshot of pipeline in Kashti]({{ "/assets/posts/automated-deployment-with-brigade/pipeline.png" | relative_url }})
{: refdef}

The final version of my `brigade.js` can be found on the GitHub repository of this website [eyjohn/evdev.me](https://github.com/eyjohn/evdev.me).

## Conclusion

Using Brigade was a big change to what I'm normally used to with other continuous integration tools such as Jenkins, which normally requires me to spend more time configuring my Jenkins instance and development environment on any nodes. Brigade, on the other hand, has very few configuration options and instead relies on users to express their jobs in a single `brigade.js` configuration file, backed by a deployment environment executed only through containers.

This required a huge mindset shift that emphasises the use of containers to execute the build, test and deployment process. This eliminates the need for a large or complex development or testing environment and encourages the use of isolated containers for each job. Furthermore, this makes it easier to run tools that might not be compatible with each other or to use new tools as everything is isolated.

After getting to grips with the Brigade fundamentals (jobs, storage/cache, secrets) I found it very intuitive to express the different jobs required for my project. When combined with GitHub integration, it can be used to create a range of workflows without much difficulty. Finally, with all the resources of my Kubernetes cluster, Brigade can start the containers whenever or wherever it needs. This certainly seems like the next step in the evolution of continuous integration and I'm looking forward to using it again for my future projects! 
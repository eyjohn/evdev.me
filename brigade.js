const { events, Job } = require("brigadier");
events.on("push", (event, project) => {
  const branch = event.revision.ref;
  const job = new Job("test-job", "alpine", [`echo ${branch}`]);
  job.streamLogs = true;
  job.run();
});


// // Brigade required secrets:
// // - FIREBASE_PROJECT_PRODUCTION : evdev-me
// // - FIREBASE_PROJECT_STAGING    : evdev-me-staging
// // - FIREBASE_TOKEN              : (run: `firebase login:ci`)

// const { events, Job } = require("brigadier");

// events.on("push", runBuildAndDeploy);

// // Build the job
// function createBuildJob(e, p) {
//   var buildJob = new Job("build-job");

//   buildJob.image = "jekyll/jekyll";

//   buildJob.tasks = [
//     "cd /src",
//     "jekyll build",
//     "cp -r firebase.json _site /build"
//   ];

//   buildJob.storage.enabled = true;
//   buildJob.storage.path = '/build';

//   buildJob.cache.size = '100Mi';
//   buildJob.cache.enabled = true;
//   buildJob.cache.path = '/usr/local/bundle';

//   buildJob.streamLogs = true;
//   return buildJob;
// }

// function createDeployJob(e, p, staging) {
//   const firebaseProject = staging ? p.secrets.FIREBASE_PROJECT_STAGING : p.secrets.FIREBASE_PROJECT_PRODUCTION;
//   var deployJob = new Job("deploy", "andreysenov/firebase-tools", [
//     'cd /build',
//     `firebase deploy --project ${firebaseProject} --token ${p.secrets.FIREBASE_TOKEN}`
//   ]);
//   deployJob.storage.enabled = true;
//   deployJob.storage.path = '/build';
//   deployJob.streamLogs = true;
//   return deployJob;
// }

// async function runBuildAndDeploy(e, p) {
//   const buildJob = createBuildJob(e, p);

//   var staging;
//   if (e.revision.ref == "refs/heads/master") {
//     staging = false;
//   } else if (e.revision.ref == "refs/heads/staging") {
//     staging = true;
//   } else {
//     return; // Nothing to do
//   }

//   const deployJob = createDeployJob(e, p, staging);

//   await buildJob.run();
//   await deployJob.run();
// }

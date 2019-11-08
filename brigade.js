// Brigade required secrets:
// - FIREBASE_PROJECT_PRODUCTION : evdev-me
// - FIREBASE_PROJECT_STAGING    : evdev-me-staging
// - FIREBASE_TOKEN              : (run: `firebase login:ci`)

const { events, Job } = require("brigadier");

events.on("push", runBuildAndDeploy);

// Build the job
function createBuildJob(event, project) {
  var buildJob = new Job("build-job");

  buildJob.image = "jekyll/jekyll";

  buildJob.tasks = [
    "cd /src",
    "jekyll build",
    "cp -r firebase.json _site /build" // firebase.json required for deployment
  ];

  buildJob.storage.enabled = true;
  buildJob.storage.path = '/build';

  buildJob.cache.size = '100Mi';
  buildJob.cache.enabled = true;
  buildJob.cache.path = '/usr/local/bundle';

  buildJob.streamLogs = true;
  return buildJob;
}

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

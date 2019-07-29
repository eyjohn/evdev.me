const { events, Job } = require("brigadier");

events.on("push", runBuildAndDeploy);

// Build the job, optionally write built files to `buildDir`
function createBuildJob(e, p, buildDir) {
  var buildJob = new Job("build-job");

  buildJob.image = "jekyll/jekyll";

  buildJob.tasks = [
    "cd /src",
    "jekyll build"
  ];

  if (buildDir) {
    buildJob.storage.enabled = true;
    buildJob.tasks.push(
      `mkdir -p ${buildDir}`,
      `cp -r firebase.json _site ${buildDir}`
    )
  }

  // Display logs from the job Pod
  buildJob.streamLogs = true;
  return buildJob;
}

// // This runs our main test job, updating GitHub along the way
// async function runChecks(e, p) {
//   console.log("check requested");

//   // This Check Run image handles updating GitHub
//   const checkRunImage = "brigadecore/brigade-github-check-run:latest";

//   // Common configuration
//   const env = {
//     CHECK_PAYLOAD: e.payload,
//     CHECK_NAME: "Brigade",
//     CHECK_TITLE: "Run Test Build",
//   };

//   // For convenience, we'll create three jobs: one for each GitHub Check
//   // stage.
//   const start = new Job("start-run", checkRunImage);
//   start.imageForcePull = true;
//   start.env = env;
//   start.env.CHECK_SUMMARY = "Beginning test build run";

//   const end = new Job("end-run", checkRunImage);
//   end.imageForcePull = true;
//   end.env = env;

//   // Now we run the jobs in order:
//   // - Notify GitHub of start
//   // - Run the test build
//   // - Notify GitHub of completion
//   //
//   // On error, we catch the error and notify GitHub of a failure.

//   const buildDir = "/mnt/brigade/share/site/";
//   const buildJob = createBuildJob(e, p, buildDir);
//   const deployJob = createDeployJob(e, p, buildDir, true); // Staging deployment
//   try {
//     await start.run();
//     await buildJob.run();
//     await deployJob.run();
//     end.env.CHECK_CONCLUSION = "success";
//     end.env.CHECK_SUMMARY = "Build completed";
//     end.env.CHECK_TEXT = result.toString();
//     await end.run();
//   } catch (err) {
//     // In this case, we mark the ending failed.
//     end.env.CHECK_CONCLUSION = "failure";
//     end.env.CHECK_SUMMARY = "Build failed";
//     end.env.CHECK_TEXT = `Error: ${err}`;
//     await end.run();
//   }
// }

function createDeployJob(e, p, buildDir, staging) {
  const firebaseProject = staging ? p.secrets.FIREBASE_PROJECT_STAGING : p.secrets.FIREBASE_PROJECT_PRODUCTION;
  var deployJob = new Job("deploy", "andreysenov/firebase-tools", [
    `cd ${buildDir}`,
    `firebase deploy --project ${firebaseProject} --token ${p.secrets.FIREBASE_TOKEN}`
  ]);
  deployJob.storage.enabled = true;
  return deployJob;
}

async function runBuildAndDeploy(e, p) {
  const buildDir = "/mnt/brigade/share/site/";
  const buildJob = createBuildJob(e, p, buildDir);

  var staging;
  if (e.revision.ref == "refs/heads/master") {
    staging = false;
  } else if (e.revision.ref == "refs/heads/staging") {
    staging = true;
  } else {
    return; // Nothing to do
  }

  const deployJob = createDeployJob(e, p, buildDir, staging);

  await buildJob.run();
  await deployJob.run();
}

"use strict";

const fs = require("fs");
const path = require("path");

const REQUIRED_MANIFESTS = {
  configMap: "configmap.yaml",
  pvc: "pvc.yaml",
  job: "job.yaml",
  cronJob: "cronjob.yaml",
};

function hitRoot() {
  return path.resolve(__dirname, "..");
}

function manifestPath(fileName, root = hitRoot()) {
  return path.join(root, "k8s", fileName);
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readManifest(fileName, root = hitRoot()) {
  return readText(manifestPath(fileName, root));
}

function extractScalar(yaml, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = yaml.match(new RegExp(`(?:^|\\n)\\s*${escaped}:\\s*"?([^"\\n]+)"?`));
  return match ? match[1].trim() : null;
}

function hasLine(yaml, line) {
  return yaml.split(/\r?\n/).some((current) => current.trim() === line);
}

function listManifestFiles(root = hitRoot()) {
  return Object.values(REQUIRED_MANIFESTS).map((fileName) =>
    manifestPath(fileName, root),
  );
}

function validateConfigMap(yaml) {
  return (
    extractScalar(yaml, "apiVersion") === "v1" &&
    extractScalar(yaml, "kind") === "ConfigMap" &&
    extractScalar(yaml, "name") === "scraper-config" &&
    extractScalar(yaml, "BROWSER") === "chrome" &&
    extractScalar(yaml, "HEADLESS") === "true" &&
    yaml.includes("bicicleta rodado 29") &&
    yaml.includes("iPhone 16 Pro Max") &&
    yaml.includes("GeForce RTX 5090")
  );
}

function validatePvc(yaml) {
  return (
    extractScalar(yaml, "apiVersion") === "v1" &&
    extractScalar(yaml, "kind") === "PersistentVolumeClaim" &&
    extractScalar(yaml, "name") === "scraper-output" &&
    yaml.includes("accessModes: [ReadWriteOnce]") &&
    extractScalar(yaml, "storageClassName") === "local-path" &&
    extractScalar(yaml, "storage") === "1Gi"
  );
}

function validateWorkload(yaml, kind, name) {
  return (
    extractScalar(yaml, "apiVersion") === "batch/v1" &&
    extractScalar(yaml, "kind") === kind &&
    extractScalar(yaml, "name") === name &&
    extractScalar(yaml, "restartPolicy") === "OnFailure" &&
    extractScalar(yaml, "image") === "ml-scraper:latest" &&
    extractScalar(yaml, "imagePullPolicy") === "IfNotPresent" &&
    extractScalar(yaml, "mountPath") === "/app/output" &&
    extractScalar(yaml, "claimName") === "scraper-output" &&
    yaml.includes("configMapRef:") &&
    hasLine(yaml, "name: scraper-config")
  );
}

function validateJob(yaml) {
  return validateWorkload(yaml, "Job", "scraper-once");
}

function validateCronJob(yaml) {
  return (
    validateWorkload(yaml, "CronJob", "scraper-hourly") &&
    extractScalar(yaml, "schedule") === "0 * * * *" &&
    extractScalar(yaml, "successfulJobsHistoryLimit") === "3" &&
    extractScalar(yaml, "failedJobsHistoryLimit") === "1"
  );
}

function validateAll(root = hitRoot()) {
  const configMap = readManifest(REQUIRED_MANIFESTS.configMap, root);
  const pvc = readManifest(REQUIRED_MANIFESTS.pvc, root);
  const job = readManifest(REQUIRED_MANIFESTS.job, root);
  const cronJob = readManifest(REQUIRED_MANIFESTS.cronJob, root);

  return {
    configMap: validateConfigMap(configMap),
    pvc: validatePvc(pvc),
    job: validateJob(job),
    cronJob: validateCronJob(cronJob),
  };
}

function allValid(results) {
  return Object.values(results).every(Boolean);
}

module.exports = {
  REQUIRED_MANIFESTS,
  allValid,
  extractScalar,
  hasLine,
  hitRoot,
  listManifestFiles,
  manifestPath,
  readManifest,
  readText,
  validateAll,
  validateConfigMap,
  validateCronJob,
  validateJob,
  validatePvc,
  validateWorkload,
};

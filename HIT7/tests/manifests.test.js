"use strict";

const fs = require("fs");
const path = require("path");
const checks = require("../src/manifestChecks");

describe("HIT7 Kubernetes manifests", () => {
  it("tiene los cuatro manifiestos requeridos", () => {
    const files = checks.listManifestFiles();

    expect(files.map((file) => path.basename(file))).toEqual([
      "configmap.yaml",
      "pvc.yaml",
      "job.yaml",
      "cronjob.yaml",
    ]);
    files.forEach((file) => {
      expect(fs.existsSync(file)).toBe(true);
      expect(fs.statSync(file).size).toBeGreaterThan(0);
    });
  });

  it("configmap define browser, headless y los tres productos", () => {
    const yaml = checks.readManifest(checks.REQUIRED_MANIFESTS.configMap);

    expect(checks.validateConfigMap(yaml)).toBe(true);
    expect(checks.extractScalar(yaml, "kind")).toBe("ConfigMap");
    expect(yaml).toContain("PRODUCTS: |");
  });

  it("pvc define almacenamiento persistente para output", () => {
    const yaml = checks.readManifest(checks.REQUIRED_MANIFESTS.pvc);

    expect(checks.validatePvc(yaml)).toBe(true);
    expect(checks.extractScalar(yaml, "storage")).toBe("1Gi");
  });

  it("job one-off monta configmap y pvc correctos", () => {
    const yaml = checks.readManifest(checks.REQUIRED_MANIFESTS.job);

    expect(checks.validateJob(yaml)).toBe(true);
    expect(checks.extractScalar(yaml, "kind")).toBe("Job");
    expect(checks.extractScalar(yaml, "name")).toBe("scraper-once");
  });

  it("cronjob corre cada hora y conserva historial acotado", () => {
    const yaml = checks.readManifest(checks.REQUIRED_MANIFESTS.cronJob);

    expect(checks.validateCronJob(yaml)).toBe(true);
    expect(checks.extractScalar(yaml, "schedule")).toBe("0 * * * *");
    expect(checks.extractScalar(yaml, "successfulJobsHistoryLimit")).toBe("3");
    expect(checks.extractScalar(yaml, "failedJobsHistoryLimit")).toBe("1");
  });

  it("validateAll resume el estado de todos los manifiestos", () => {
    const result = checks.validateAll();

    expect(result).toEqual({
      configMap: true,
      pvc: true,
      job: true,
      cronJob: true,
    });
    expect(checks.allValid(result)).toBe(true);
  });

  it("detecta manifiestos inválidos", () => {
    expect(checks.validateConfigMap("kind: Secret")).toBe(false);
    expect(checks.validatePvc("kind: Pod")).toBe(false);
    expect(checks.validateWorkload("kind: Job", "Job", "scraper-once")).toBe(false);
    expect(checks.hasLine("a\n  name: scraper-config\n", "name: scraper-config")).toBe(true);
  });
});

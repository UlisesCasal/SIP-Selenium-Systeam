"use strict";

/**
 * Rate limiting entre requests — NO es sincronización de UI.
 * Para esperar elementos del DOM usar explicit waits en los Page Objects.
 */
function throttle(ms = 1500) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = throttle;

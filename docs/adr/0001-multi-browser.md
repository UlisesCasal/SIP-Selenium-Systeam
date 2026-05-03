# 0001 — Soporte Multi-Browser simultáneo (Chrome y Firefox)

- **Date:** 2026-05-01
- **Status:** Accepted
- **Deciders:** Grupo Systeam

## Contexto

El objetivo del sistema es extraer datos de MercadoLibre de manera automatizada y confiable. Al depender de un único navegador (por ejemplo, solo Chrome), el scraper queda expuesto a un punto único de fallo:
- **Medidas Anti-Bot:** Plataformas grandes actualizan constantemente sus sistemas de detección (fingerprinting). Si un motor es bloqueado o detectado como headless, todo el sistema de extracción se detiene.
- **Inconsistencias de renderizado:** Ocasionalmente, el DOM o los tiempos de carga de JavaScript pueden comportarse de manera ligeramente distinta dependiendo del motor (Blink en Chrome vs. Gecko en Firefox).
- **Flexibilidad de despliegue:** Necesitamos que el código sea agnóstico al navegador subyacente para poder ejecutarlo en distintos entornos (locales o en integración continua) según los recursos disponibles.

## Decisión

Decidimos soportar e implementar la ejecución de nuestros scripts tanto en **Google Chrome** como en **Mozilla Firefox** de forma simultánea, abstrayendo la creación de los WebDrivers a través de un patrón de diseño implementado en nuestro `BrowserFactory.js` y `BrowserOptions.js`. 

En lugar de atar el código a una implementación específica de ChromeDriver, el scraper lee la configuración y puede instanciar cualquiera de los dos navegadores para realizar las pruebas y la recolección de datos.

## Consecuencias

- **Positivas (Beneficios):**
  - **Mayor resiliencia:** Si las protecciones bloquean la firma de Chrome Headless, tenemos un plan de contingencia inmediato cambiando la ejecución a Firefox.
  - **Código más limpio y modular:** Nos obligó a crear una arquitectura donde la lógica de scraping está totalmente desacoplada de la configuración del navegador.
  - **Cobertura de pruebas:** Aumentamos la confiabilidad del scraper al asegurar que los selectores y las esperas explícitas funcionan independientemente del motor de renderizado.

- **Negativas (Trade-offs):**
  - **Complejidad de entorno:** Requiere mantener instalados y actualizados dos binarios diferentes (ChromeDriver y GeckoDriver) tanto en los entornos locales de los desarrolladores como en los pipelines de CI/CD.
  - **Mayor consumo de recursos:** Ejecutar suites de pruebas cruzadas consume el doble de tiempo y recursos computacionales.
  - **Mantenimiento:** Si un selector de CSS se comporta distinto en Gecko que en Blink, el equipo debe invertir tiempo extra en encontrar estrategias de selectores más genéricas.

## Referencias

- Selenium Cross Browser Testing: https://www.selenium.dev/documentation/test_practices/testing_guidelines/cross_browser_testing/
- MDN Web Docs - Motores de navegadores: https://developer.mozilla.org/es/docs/Web/Performance/How_browsers_work

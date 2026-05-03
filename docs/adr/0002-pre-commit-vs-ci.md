# 0002 — División de validaciones entre pre-commit local y CI remoto

- **Date:** 2026-05-01
- **Status:** Accepted
- **Deciders:** Grupo Systeam

## Contexto

Para mantener la calidad del código y asegurar que nuestro scraper funcione correctamente, implementamos validaciones automáticas (linter, detección de secretos y tests con Jest). Ejecutar la suite completa de pruebas E2E (End-to-End) con Selenium en múltiples navegadores consume mucho tiempo y recursos.
Si delegamos todas las validaciones a la Integración Continua (CI) en GitHub Actions, el tiempo de feedback es muy lento (el desarrollador debe pushear y esperar varios minutos para saber si rompió algo básico). Por otro lado, obligar al desarrollador a correr toda la suite E2E localmente antes de cada commit genera fricción y demora el desarrollo.

## Decisión

Decidimos dividir las responsabilidades de validación basándonos en el trade-off de "tiempo de feedback vs. costo de ejecución":

1. **Pre-commit local (Husky / lint-staged):** Se ejecutan validaciones estáticas y de ejecución ultrarrápida. Esto incluye el linter (ESLint/Prettier), la detección de secretos (para evitar commitear credenciales del `.env` por error) y tests unitarios rápidos.
2. **CI remoto (GitHub Actions):** Se ejecuta en cada `push` o Pull Request hacia la rama principal. Actúa como la fuente de la verdad absoluta. Aquí se instalan los navegadores y se corren los flujos de `.github/workflows/` (HIT1, HIT2, HIT3), ejecutando la suite completa de tests de integración y E2E de Selenium.

## Consecuencias

- **Positivas (Beneficios):**
  - **Feedback inmediato:** Los errores de sintaxis, formato o secretos filtrados se detectan en segundos antes de que el código abandone la máquina del desarrollador.
  - **Ahorro de recursos en CI:** Evitamos consumir minutos valiosos (y potencialmente costosos) de GitHub Actions por commits que fallan por un error tipográfico.
  - **Flujo de trabajo fluido:** Los desarrolladores no tienen que esperar a que se levanten instancias de Chrome/Firefox locales para hacer commits pequeños.

- **Negativas (Trade-offs):**
  - **Falsa sensación de seguridad local:** Un commit puede pasar el pre-commit local pero romper los tests E2E en la nube, requiriendo un commit adicional de corrección.
  - **Bypass de reglas:** Los desarrolladores pueden saltarse los hooks locales usando `git commit --no-verify`, por lo que el CI sigue siendo estrictamente necesario como barrera final.
  - **Mantenimiento dual:** Hay que configurar y mantener dos entornos de ejecución distintos (el de los hooks locales en el `package.json` y los `.yml` de GitHub Actions).

## Referencias

- GitHub Actions Documentation: https://docs.github.com/en/actions
- Git Hooks (Pre-commit): https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks

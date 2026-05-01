# 0003 — Estrategia de Throttling y control de tasa de peticiones

- **Date:** 2026-05-01
- **Status:** Accepted
- **Deciders:** Grupo Systeam

## Contexto

Nuestro sistema tiene la responsabilidad de extraer datos constantemente de MercadoLibre. Durante el desarrollo de los módulos de extracción, notamos que si Selenium ejecuta las instrucciones de navegación y extracción de la forma más rápida que permite el hardware y la red, el comportamiento resulta mecánicamente evidente. 
MercadoLibre (y la mayoría de las plataformas modernas) implementan sistemas de Web Application Firewall (WAF) y medidas anti-bot que detectan picos inusuales de tráfico desde una misma IP. Realizar demasiadas peticiones en un corto período de tiempo resulta en baneos temporales de IP, bloqueos de conexión o la aparición forzada de CAPTCHAs, rompiendo por completo la automatización.

## Decisión

Decidimos implementar una estrategia centralizada de *throttling* (limitación de tasa) para controlar la velocidad y frecuencia de las interacciones del scraper. Para esto, creamos una utilidad dedicada en `src/utils/throttle.js`[cite: 1]. 

En lugar de depender únicamente de esperas implícitas o explícitas (que solo esperan a que un elemento esté disponible), el módulo de throttling nos permite definir un intervalo mínimo obligatorio entre acciones críticas (como cargar una nueva página de resultados o iterar sobre múltiples publicaciones), forzando al scraper a "respirar" y simulando un comportamiento de navegación más humano.

## Consecuencias

- **Positivas (Beneficios):**
  - **Evasión de bloqueos:** Reducimos drásticamente la probabilidad de que MercadoLibre identifique al script como un ataque DDoS o un scraper agresivo, garantizando la continuidad de la extracción.
  - **Estabilidad de red:** Evitamos saturar la conexión local y los recursos del servidor destino, cumpliendo con las buenas prácticas de *politeness* (cortesía) en el web scraping.
  - **Centralización:** Al tener la lógica en `throttle.js`[cite: 1], podemos ajustar los tiempos de espera globales desde un solo lugar si las políticas defensivas de la plataforma cambian en el futuro.

- **Negativas (Trade-offs):**
  - **Mayor tiempo de ejecución:** El tiempo total para completar una corrida de recolección de datos aumenta significativamente. Extraer cientos de productos lleva mucho más tiempo que si no hubiera límites.
  - **Ajuste manual (Fine-tuning):** Requiere prueba y error para encontrar el "punto óptimo" (el tiempo de espera exacto que sea lo suficientemente rápido para el negocio, pero lo suficientemente lento para no ser detectado).

## Referencias

- Web Scraping Politeness & Rate Limiting: https://en.wikipedia.org/wiki/Web_scraping#Technical_measures_to_stop_bot_activity
- OWASP Automated Threat Handbook (Web Scraping): https://owasp.org/www-project-automated-threats-to-web-applications/
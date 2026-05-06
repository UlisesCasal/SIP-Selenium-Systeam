# Cookbook KQL: 6+ queries útiles

A continuación se presentan 6 queries obligatorias en KQL (Kibana Query Language) para analizar los logs del scraper de MercadoLibre, comparando su sintaxis con el motor legacy (Lucene).

💡 **Nota sobre KQL vs Lucene**: Kibana 8+ utiliza KQL por defecto. A diferencia de Lucene (que usa sintaxis estricta `field:value AND field:value`), KQL es más permisivo, case-insensitive en sus operadores booleanos (`and`, `or`, `not`), y maneja los wildcards de forma más predecible. Para demostrar este conocimiento, se incluye el equivalente en Lucene de cada query, entendiendo las diferencias clave entre ambos motores.

---

## Q1: Errores por producto en las últimas 24h

**Pregunta de negocio**: ¿Qué productos están generando la mayor cantidad de errores en nuestra ingesta diaria?

- **Query KQL**: `level: "ERROR" and producto: *`
- **Equivalente Lucene**: `level:"ERROR" AND _exists_:producto`
- **Screenshot**:
  ![Screenshot Q1 - Errores por producto](./screenshots/q1_errores_producto.png)
- **Análisis Técnico**:
  Utilizamos el operador de existencia `producto: *` en KQL para asegurar que solo traemos logs que tengan ese campo definido (en la ventana temporal del time picker). Evaluar la existencia de un campo mapeado como `keyword` es sumamente rápido y eficiente en costo computacional, a diferencia de buscar substrings con wildcards en campos de tipo `text`.

---

## Q2: Top selectores faltantes

**Pregunta de negocio**: ¿Qué filtros o selectores de UI del frontend de ML están fallando y en qué productos?

- **Query KQL**: `message: "Filtro * no disponible" and producto: *`
- **Equivalente Lucene**: `message:"Filtro * no disponible" AND _exists_:producto`
- **Screenshot**:
  ![Screenshot Q2 - Selectores faltantes](./screenshots/q2_selectores_faltantes.png)
- **Análisis Técnico**:
  El campo `message` suele ser de tipo `text` (analizado). Usamos un wildcard `*` intermedio en la frase. En el viejo Lucene esto era muy costoso ("expensive query"), pero KQL optimiza estas búsquedas, cruzándolo rápidamente con la existencia del keyword `producto` (que actúa como un filtro duro inicial).

---

## Q3: Distribución de duración del Job

**Pregunta de negocio**: ¿Cuál es la varianza y la distribución de tiempos que le toma al scraper completar un scrapeo exitoso?

- **Query KQL**: `event: "scrape_completado" and job_duration_ms >= 0`
- **Equivalente Lucene**: `event:"scrape_completado" AND job_duration_ms:[0 TO *]`
- **Screenshot**:
  ![Screenshot Q3 - Duración del job](./screenshots/q3_distribucion_duracion.png)
- **Análisis Técnico**:
  Al usar operadores de rango matemáticos (`>=`) sobre un campo mapeado numéricamente (`long` o `integer`), Elasticsearch aprovecha el índice de árbol BKD subyacente, haciendo que esta consulta sea instantánea. Esta query está explícitamente diseñada para agruparse visualmente en un panel tipo Histograma.

---

## Q4: Logs con timeout de Selenium en cualquier producto

**Pregunta de negocio**: ¿Cuántos fallos en el sistema se deben a timeouts puros de la librería de Selenium o de sus extractores?

- **Query KQL**: `message: *timeout* and (logger: "selenium*" or logger: "extractors")`
- **Equivalente Lucene**: `message:*timeout* AND (logger:selenium* OR logger:extractors)`
- **Screenshot**:
  ![Screenshot Q4 - Timeouts Selenium](./screenshots/q4_timeouts_selenium.png)
- **Análisis Técnico**:
  Un wildcard líder y final (`*timeout*`) en el campo `message` (texto libre) fuerza un escaneo costoso. Para optimizar esto, lo combinamos en un bloque estricto `(...)` contra el campo `logger` (keyword), lo que reduce drásticamente el espacio de documentos a escanear filtrando primero velozmente a través del índice invertido.

---

## Q5: Eventos del CronJob específico

**Pregunta de negocio**: ¿Qué ocurrió exactamente paso a paso en la ejecución instanciada por el CronJob de prueba "scraper-test-1"?

- **Query KQL**: `kubernetes.labels.job_name: "scraper-test-1"`
- **Equivalente Lucene**: `kubernetes.labels.job_name:"scraper-test-1"`
- **Screenshot**:
  ![Screenshot Q5 - Eventos CronJob](./screenshots/q5_eventos_cronjob.png)
- **Análisis Técnico**:
  Aprovechamos la inyección de metadata profunda y estructurada que realiza Fluent Bit en Kubernetes. Al consultar campos anidados (nested fields) que son fuertemente tipados como `keyword` (los labels de K8s), obtenemos correlación directa O(1) de todos los pods efímeros que pertenecieron a ese Job específico, vital para troubleshooting distribuido.

---

## Q6: Errores excluyendo el módulo de Postgres

**Pregunta de negocio**: ¿Qué errores de aplicación tenemos si filtramos de la vista los falsos positivos o desconexiones intermitentes conocidas de la base de datos?

- **Query KQL**: `level: "ERROR" and not logger: "psycopg*"`
- **Equivalente Lucene**: `level:"ERROR" AND NOT logger:psycopg*`
- **Screenshot**:
  ![Screenshot Q6 - Errores No Postgres](./screenshots/q6_errores_no_postgres.png)
- **Análisis Técnico**:
  Se emplea la exclusión (`not`) sobre un prefijo del módulo de base de datos (`psycopg*`). Al aplicar un wildcard exclusivo de sufijo en un campo `keyword` (`logger`), Elasticsearch evalúa velozmente el prefijo en el diccionario, descartando rápidamente todos los logs asociados sin impacto penalizable en la CPU.

---

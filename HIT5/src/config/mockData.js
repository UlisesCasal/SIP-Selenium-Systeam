"use strict";

const MOCK_DATA = {
  "bicicleta rodado 29": [
    { titulo: "Bicicleta MTB Rodado 29 Shimano 21 Velocidades Freno Disco", precio: 289999, link: "https://www.mercadolibre.com.ar/p/MLA1001000001", tienda_oficial: null, envio_gratis: true, cuotas_sin_interes: "12 cuotas sin interés" },
    { titulo: "Bicicleta Rodado 29 Aluminio Doble Suspension 24 Vel", precio: 349999, link: "https://www.mercadolibre.com.ar/p/MLA1001000002", tienda_oficial: null, envio_gratis: true, cuotas_sin_interes: null },
    { titulo: "Bicicleta Mountain Bike Rodado 29 Trek Marlin 5", precio: 520000, link: "https://www.mercadolibre.com.ar/p/MLA1001000003", tienda_oficial: "Trek Argentina", envio_gratis: true, cuotas_sin_interes: "18 cuotas sin interés" },
    { titulo: "Bicicleta Rodado 29 Slp Full Suspension Hidraulico", precio: 275000, link: "https://www.mercadolibre.com.ar/p/MLA1001000004", tienda_oficial: null, envio_gratis: false, cuotas_sin_interes: null },
    { titulo: "Bicicleta MTB Rodado 29 Specialized Rockhopper 2024", precio: 680000, link: "https://www.mercadolibre.com.ar/p/MLA1001000005", tienda_oficial: "Specialized", envio_gratis: true, cuotas_sin_interes: "24 cuotas sin interés" },
    { titulo: "Bicicleta Rodado 29 Hombre Dama Cannondale Trail 6", precio: 598000, link: "https://www.mercadolibre.com.ar/p/MLA1001000006", tienda_oficial: null, envio_gratis: true, cuotas_sin_interes: "12 cuotas sin interés" },
    { titulo: "Bicicleta Orbea Onna 50 Rodado 29 Aluminio", precio: 450000, link: "https://www.mercadolibre.com.ar/p/MLA1001000007", tienda_oficial: null, envio_gratis: true, cuotas_sin_interes: null },
    { titulo: "Bicicleta Mountain Bike Rodado 29 Freno Hidraulico 11 Vel", precio: 399999, link: "https://www.mercadolibre.com.ar/p/MLA1001000008", tienda_oficial: null, envio_gratis: false, cuotas_sin_interes: "6 cuotas sin interés" },
    { titulo: "Bicicleta Mtb Rodado 29 Giant Talon 3 2024", precio: 720000, link: "https://www.mercadolibre.com.ar/p/MLA1001000009", tienda_oficial: "Giant Argentina", envio_gratis: true, cuotas_sin_interes: "18 cuotas sin interés" },
    { titulo: "Bicicleta Rodado 29 Acero Carbon Shimano Altus", precio: 230000, link: "https://www.mercadolibre.com.ar/p/MLA1001000010", tienda_oficial: null, envio_gratis: true, cuotas_sin_interes: null },
  ],

  "iPhone 16 Pro Max": [
    { titulo: "Apple iPhone 16 Pro Max 256GB Negro Titanio", precio: 2199999, link: "https://www.mercadolibre.com.ar/p/MLA1002000001", tienda_oficial: "Apple", envio_gratis: true, cuotas_sin_interes: "24 cuotas sin interés" },
    { titulo: "Apple iPhone 16 Pro Max 512GB Blanco Titanio Sellado", precio: 2650000, link: "https://www.mercadolibre.com.ar/p/MLA1002000002", tienda_oficial: "Apple", envio_gratis: true, cuotas_sin_interes: "24 cuotas sin interés" },
    { titulo: "iPhone 16 Pro Max 256GB Desert Titanio Nuevo Garantia", precio: 2050000, link: "https://www.mercadolibre.com.ar/p/MLA1002000003", tienda_oficial: null, envio_gratis: true, cuotas_sin_interes: "12 cuotas sin interés" },
    { titulo: "Apple iPhone 16 Pro Max 1TB Natural Titanium", precio: 3100000, link: "https://www.mercadolibre.com.ar/p/MLA1002000004", tienda_oficial: "Apple", envio_gratis: true, cuotas_sin_interes: "24 cuotas sin interés" },
    { titulo: "iPhone 16 Pro Max 256Gb Negro Titanio Sellado Oficial", precio: 1980000, link: "https://www.mercadolibre.com.ar/p/MLA1002000005", tienda_oficial: null, envio_gratis: false, cuotas_sin_interes: null },
    { titulo: "Apple iPhone 16 Pro Max 512Gb Azul Titanio Garantia", precio: 2700000, link: "https://www.mercadolibre.com.ar/p/MLA1002000006", tienda_oficial: "Movistar", envio_gratis: true, cuotas_sin_interes: "18 cuotas sin interés" },
    { titulo: "iPhone 16 Pro Max 256GB Black Titanium + Cargador 30W", precio: 2250000, link: "https://www.mercadolibre.com.ar/p/MLA1002000007", tienda_oficial: null, envio_gratis: true, cuotas_sin_interes: "12 cuotas sin interés" },
    { titulo: "Apple iPhone 16 Pro Max 128Gb Titanio Natural Caja", precio: 1850000, link: "https://www.mercadolibre.com.ar/p/MLA1002000008", tienda_oficial: null, envio_gratis: true, cuotas_sin_interes: null },
    { titulo: "iPhone 16 Pro Max 512Gb Desert Titanium Libre", precio: 2580000, link: "https://www.mercadolibre.com.ar/p/MLA1002000009", tienda_oficial: null, envio_gratis: false, cuotas_sin_interes: null },
    { titulo: "Apple iPhone 16 Pro Max 256Gb White Titanium Nuevo", precio: 2199999, link: "https://www.mercadolibre.com.ar/p/MLA1002000010", tienda_oficial: "Apple", envio_gratis: true, cuotas_sin_interes: "24 cuotas sin interés" },
  ],

  "GeForce RTX 5090": [
    { titulo: "Nvidia GeForce RTX 5090 32GB GDDR7 ASUS ROG Astral", precio: 5999999, link: "https://www.mercadolibre.com.ar/p/MLA1003000001", tienda_oficial: "ASUS", envio_gratis: true, cuotas_sin_interes: "24 cuotas sin interés" },
    { titulo: "Placa de Video MSI GeForce RTX 5090 32GB Suprim Liquid X", precio: 6200000, link: "https://www.mercadolibre.com.ar/p/MLA1003000002", tienda_oficial: "MSI Argentina", envio_gratis: true, cuotas_sin_interes: "24 cuotas sin interés" },
    { titulo: "RTX 5090 Gigabyte Aorus Master 32GB GDDR7", precio: 5750000, link: "https://www.mercadolibre.com.ar/p/MLA1003000003", tienda_oficial: null, envio_gratis: true, cuotas_sin_interes: "12 cuotas sin interés" },
    { titulo: "GeForce RTX 5090 32GB Zotac AMP Extreme Airo", precio: 5500000, link: "https://www.mercadolibre.com.ar/p/MLA1003000004", tienda_oficial: null, envio_gratis: false, cuotas_sin_interes: null },
    { titulo: "Nvidia RTX 5090 32GB EVGA FTW3 Ultra Gaming", precio: 6100000, link: "https://www.mercadolibre.com.ar/p/MLA1003000005", tienda_oficial: null, envio_gratis: true, cuotas_sin_interes: "18 cuotas sin interés" },
    { titulo: "Placa Video RTX 5090 32GB Founders Edition Nvidia", precio: 4999999, link: "https://www.mercadolibre.com.ar/p/MLA1003000006", tienda_oficial: "Nvidia", envio_gratis: true, cuotas_sin_interes: "24 cuotas sin interés" },
    { titulo: "RTX 5090 32Gb Palit GameRock OC GDDR7 Sellada", precio: 5650000, link: "https://www.mercadolibre.com.ar/p/MLA1003000007", tienda_oficial: null, envio_gratis: true, cuotas_sin_interes: null },
    { titulo: "Geforce RTX 5090 32GB XFX Speedster Merc 310 Black", precio: 5300000, link: "https://www.mercadolibre.com.ar/p/MLA1003000008", tienda_oficial: null, envio_gratis: false, cuotas_sin_interes: "6 cuotas sin interés" },
    { titulo: "ASUS TUF Gaming RTX 5090 32GB OC Edition", precio: 5800000, link: "https://www.mercadolibre.com.ar/p/MLA1003000009", tienda_oficial: "ASUS", envio_gratis: true, cuotas_sin_interes: "12 cuotas sin interés" },
    { titulo: "RTX 5090 MSI Ventus 3X OC 32GB GDDR7 Nueva Sellada", precio: 5100000, link: "https://www.mercadolibre.com.ar/p/MLA1003000010", tienda_oficial: null, envio_gratis: true, cuotas_sin_interes: null },
  ],
};

function getProducts(productName, limit = 10) {
  const key = Object.keys(MOCK_DATA).find(
    (k) => k.toLowerCase() === productName.toLowerCase(),
  );
  const products = key ? MOCK_DATA[key] : [];
  return products.slice(0, limit);
}

module.exports = { getProducts };

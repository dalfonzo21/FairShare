# FairShare 

**FairShare** es una aplicación web moderna, rápida y responsiva diseñada para dividir gastos compartidos en salidas, viajes, cenas o compañeros de piso de forma transparente, equitativa y sin complicaciones.

Permite registrar quién pagó cada cuenta, quiénes participaron en cada consumo y calcula automáticamente el balance de cada persona junto con el **mínimo número de transferencias** necesarias para saldar todas las deudas del grupo.

---

## Características Principales

- **Gestión de Participantes**: Agrega integrantes con nombres y avatares de colores personalizados.
- **Registro y Categorización de Gastos**: Clasifica gastos por categorías (Comida, Supermercado, Bebidas, Transporte, Alojamiento, Entradas, etc.) y asigna quién pagó.
- **División Flexible**: Divide cada gasto equitativamente entre todos o selecciona solo a los participantes que consumieron.
- **Vista Cronológica por Días**: Alterna entre una lista continua y un desglose por días con subtotales automáticos por fecha.
- **Liquidación Óptima de Deudas**: Algoritmo inteligente que empareja acreedores y deudores para liquidar las cuentas con el menor número de transferencias posibles.
- **Exportación para WhatsApp**: Genera un resumen en texto limpio y ordenado listo para copiar y enviar al chat del grupo.
- **Gestión de Múltiples Eventos**: Crea y alterna entre diferentes viajes o eventos guardados.
- **Autenticación y Espacio Privado**: Inicio de sesión con Google (1 clic) o Correo/Contraseña con Firebase Authentication. Cada usuario cuenta con su propio espacio privado en la nube.
- **Diseño 100% Responsivo**: Interfaz moderna, limpia y optimizada tanto para celulares como para pantallas de escritorio.
- **Modo Híbrido**: Funciona tanto en modo local (LocalStorage) como sincronizado en la nube (Cloud Firestore).

---

## Tecnologías Utilizadas

- **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
- **Backend & Base de Datos**: [Firebase Authentication](https://firebase.google.com/docs/auth), [Cloud Firestore](https://firebase.google.com/docs/firestore)
- **Iconografía**: [Lucide React](https://lucide.dev/)
- **Animaciones**: [Canvas Confetti](https://www.npmjs.com/package/canvas-confetti)
- **Despliegue**: [Vercel](https://vercel.com/)

---

## Instalación y Ejecución Local

### 1. Clonar el repositorio
```bash
git clone https://github.com/dalfonzo21/FairShare.git
cd FairShare
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno (Firebase)
Copia el archivo `.env.example` y renómbralo a `.env`:
```bash
cp .env.example .env
```

Edita `.env` con tus credenciales de Firebase:
```env
FIREBASE_API_KEY=AIzaSy...
FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
FIREBASE_PROJECT_ID=tu-proyecto
FIREBASE_STORAGE_BUCKET=tu-proyecto.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef
```

> **Nota**: Si no configuras las credenciales de Firebase, la aplicación funcionará automáticamente en modo **Local** utilizando el almacenamiento de tu navegador.

### 4. Iniciar el servidor de desarrollo
```bash
npm run dev
```
Abre tu navegador en `http://localhost:5173`.

---

## Configuración para Despliegue en Vercel

Para que la autenticación con Google y el guardado en Firestore funcionen al desplegar en **Vercel**:

### 1. Variables de Entorno en Vercel
En tu panel de [Vercel](https://vercel.com/) ➔ **Project Settings** ➔ **Environment Variables**, agrega las variables de Firebase de tu archivo `.env`:
- `FIREBASE_API_KEY` (o `VITE_FIREBASE_API_KEY`)
- `FIREBASE_AUTH_DOMAIN` (o `VITE_FIREBASE_AUTH_DOMAIN`)
- `FIREBASE_PROJECT_ID` (o `VITE_FIREBASE_PROJECT_ID`)
- `FIREBASE_STORAGE_BUCKET` (o `VITE_FIREBASE_STORAGE_BUCKET`)
- `FIREBASE_MESSAGING_SENDER_ID` (o `VITE_FIREBASE_MESSAGING_SENDER_ID`)
- `FIREBASE_APP_ID` (o `VITE_FIREBASE_APP_ID`)

### 2. Dominios Autorizados en Firebase
En [Firebase Console](https://console.firebase.google.com/) ➔ **Authentication** ➔ **Settings** ➔ **Authorized Domains**, haz clic en **Add domain** y agrega la URL de tu despliegue en Vercel (ej: `fairshare.vercel.app`).

### 3. Reglas de Seguridad en Firestore
En Firebase Console ➔ **Firestore Database** ➔ **Reglas (Rules)**, asegúrate de tener publicadas las reglas incluidas en [`firestore.rules`](./firestore.rules):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/groups/{groupId} {
      allow read, write: if true;
    }
    match /fairshare_groups/{groupId} {
      allow read, write: if true;
    }
  }
}
```

---

## Scripts Disponibles

- `npm run dev`: Inicia el servidor de desarrollo local con Vite.
- `npm run build`: Compila la aplicación y verifica tipos de TypeScript para producción (`/dist`).
- `npm run preview`: Previsualiza la compilación de producción localmente.
- `npm run lint`: Ejecuta el linter ESLint para análisis de código.

---

## Estructura del Proyecto

```text
FairShare/
├── src/
│   ├── components/       # Componentes UI (Header, ExpenseList, SettlementView, etc.)
│   ├── services/         # Servicios de Firebase Auth/Firestore y LocalStorage
│   ├── types/            # Definiciones de TypeScript (Person, Expense, Group, etc.)
│   ├── utils/            # Algoritmo de liquidación y generación de resumen para WhatsApp
│   ├── App.tsx           # Componente principal y orquestador de estado
│   ├── App.css           # Estilos de componentes y reglas responsivas
│   ├── index.css         # Tokens de diseño y estilos globales
│   └── main.tsx          # Punto de entrada de React
├── .env.example          # Plantilla de variables de entorno
├── firestore.rules       # Reglas de seguridad para Firebase Firestore
├── vercel.json           # Configuración de rutas para Vercel
├── package.json          # Dependencias y scripts
└── vite.config.ts        # Configuración del empaquetador Vite
```

---

## Licencia

Este proyecto está bajo la Licencia MIT.

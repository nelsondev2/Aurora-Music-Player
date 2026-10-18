# Imagen de producción de Aurora Music Player (estático + API de salud).
FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

WORKDIR /app

# Solo dependencias de producción (express).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Lista blanca real de la app: lo que no esté aquí no se sirve ni viaja.
COPY server.js index.html styles.css data.js storage.js uploader.js webxdc.js \
     manifest.toml metadata.json icon.png LICENSE ./
COPY js ./js
COPY assets ./assets

# Sin privilegios: el usuario node viene en la imagen oficial.
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]

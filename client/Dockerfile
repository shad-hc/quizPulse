FROM node:18-alpine AS builder
WORKDIR /app

COPY package.json ./
RUN npm install --legacy-peer-deps

COPY public ./public
COPY src ./src
COPY tsconfig.json ./

ARG REACT_APP_API_URL=http://localhost:4000/api
ARG REACT_APP_WS_URL=ws://localhost:4000
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_WS_URL=$REACT_APP_WS_URL
ENV CI=false

RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]

FROM node:current-alpine AS BUILD_IMAGE
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:current-alpine
WORKDIR /usr/src/app

RUN apk add --no-cache curl jq;

ENV DOCKER=true

COPY --from=BUILD_IMAGE /usr/src/app/dist ./
RUN rm ./*.js.map

COPY ./docker-start.sh .
RUN chmod +x ./docker-start.sh

CMD ["./docker-start.sh"]

FROM node:12.20.1-alpine3.12

RUN mkdir /app
RUN mkdir /app/config
WORKDIR /app

ADD package.json /app/
RUN npm install

COPY getQuality.js /app
COPY ddwrt.js /app

ADD ./config/config.json /app/config/
ADD VERSION .
ADD Dockerfile .
ADD build_container.sh .

CMD [ "npm", "start" ]

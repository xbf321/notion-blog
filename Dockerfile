ARG MAINTAINER
FROM node:20-slim

COPY . /app
WORKDIR /app

COPY ./rclone /usr/bin/
COPY ./rclone.conf.example /root/.config/rclone/rclone.conf
RUN chown root:root /usr/bin/rclone
RUN chmod 755 /usr/bin/rclone

RUN npm install --registry=https://registry.npmmirror.com

ENV PORT=7110
ENV NODE_ENV=production

EXPOSE 7110

CMD [ "pnpm", "start" ]
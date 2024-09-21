ARG MAINTAINER
FROM node:20

WORKDIR /root/

RUN <<EOF

curl -O https://downloads.rclone.org/rclone-current-linux-amd64.zip
unzip rclone-current-linux-amd64.zip
cd rclone-*-linux-amd64
cp rclone /usr/bin/
chown root:root /usr/bin/rclone
chmod 755 /usr/bin/rclone

EOF

COPY . /root/web/
COPY ./rclone.conf.example /root/.config/rclone/rclone.conf

WORKDIR /root/web
RUN npm install --registry=https://registry.npmmirror.com


ENV PORT=7110
ENV NODE_ENV=production

EXPOSE 7110

CMD [ "npm", "start" ]
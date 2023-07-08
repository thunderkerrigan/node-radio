FROM node:alpine as builder
WORKDIR '/app'
COPY package.json .
RUN npm install
COPY . .
RUN npm run build


FROM node:alpine
# /app is the folder where the app will be installed
WORKDIR '/app'
# copy the build folder from the previous stage
COPY --from=builder /app/build ./
COPY package.json .
# install the dependencies
RUN npm install --omit=dev
RUN mkdir -p /app/playlists
# run the app
EXPOSE 3000
CMD ["node", "app.js"]


# Step 0: stop active containers
docker stop pf-db pf-api
docker image prune

# Step 1: Create a Docker volume for MongoDB data persistence
docker volume create pf-db-data

# Step 2: Create a network for the containers
docker network create pf-network

# Step 3: Run the MongoDB container with persistent storage
# username and password are just an example, change them!
docker run -d \
  --rm \
  --name pf-db \
  --network pf-network \
  -p 27017:27017 \
  -v pf-db-data:/data/db \
  -e MONGO_INITDB_ROOT_USERNAME=root \
  -e MONGO_INITDB_ROOT_PASSWORD=example \
  mongo:6.0

# Step 4: Build the pf-api Docker image
docker build -t pf-api .

# Step 5: Run the pf-api container
docker run  \
  --rm \
  --name pf-api \
  --network pf-network \
  -p 8000:8000 \
  -v "${PWD}/static:/pfapi/static/" \
  -v "${PWD}/env:/pfapi/env/" \
  pf-api

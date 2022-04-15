echo "BUILDING"
docker-compose build

echo "TAGGING"
docker tag opensync_web totalplatform/openmail:latest

echo "PUSHING"
docker push totalplatform/openmail:latest

echo "DONE"
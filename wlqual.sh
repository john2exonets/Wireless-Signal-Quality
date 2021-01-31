docker run --detach \
    --name wlqual \
    --restart always \
    --volume /root/Docker/wlQual:/app/config \
    jdallen/wlqual:latest


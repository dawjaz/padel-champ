# Website for portresgame.com: the landing page and the privacy policy, served by nginx.
# Built by Coolify on the owner's server (build pack "Dockerfile", base directory "/", Dockerfile "/site/Dockerfile", port 80).
# The files stay where they are in public/ so GitHub Pages keeps publishing the same pages under /landing/.
FROM nginx:1.27-alpine
COPY site/nginx.conf /etc/nginx/conf.d/default.conf
COPY public/landing/ /usr/share/nginx/html/
COPY public/privacy.html /usr/share/nginx/html/privacy.html
EXPOSE 80

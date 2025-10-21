#!/bin/bash

set -e

echo "=== Getty Monitoring Setup - Native Installation ==="
echo

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root or with sudo"
    exit 1
fi

echo "Installing Prometheus..."
PROMETHEUS_VERSION="2.45.0"
wget -q https://github.com/prometheus/prometheus/releases/download/v${PROMETHEUS_VERSION}/prometheus-${PROMETHEUS_VERSION}.linux-amd64.tar.gz
tar xvf prometheus-${PROMETHEUS_VERSION}.linux-amd64.tar.gz
mv prometheus-${PROMETHEUS_VERSION}.linux-amd64 /opt/prometheus
useradd -rs /bin/false prometheus || true
chown -R prometheus:prometheus /opt/prometheus

echo "Installing Grafana..."
apt-get update
apt-get install -y apt-transport-https software-properties-common wget gnupg
mkdir -p /etc/apt/keyrings
wget -q -O - https://apt.grafana.com/gpg.key | gpg --dearmor | tee /etc/apt/keyrings/grafana.gpg > /dev/null
echo "deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main" > /etc/apt/sources.list.d/grafana.list
apt-get update
apt-get install -y grafana

echo "Configuring Prometheus..."
cp /opt/prometheus/prometheus.yml /opt/prometheus/prometheus.yml.backup

echo "Creating systemd services..."

cat > /etc/systemd/system/prometheus.service << EOF
[Unit]
Description=Prometheus
Wants=network-online.target
After=network-online.target

[Service]
User=prometheus
Group=prometheus
Type=simple
ExecStart=/opt/prometheus/prometheus --config.file=/opt/prometheus/prometheus.yml --storage.tsdb.path=/opt/prometheus/data --web.listen-address=:9090

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable prometheus
systemctl enable grafana-server
systemctl start prometheus
systemctl start grafana-server

rm -rf prometheus-${PROMETHEUS_VERSION}.linux-amd64.tar.gz

echo
echo "=== Installation Complete ==="
echo
echo "Next steps:"
echo "1. Edit /opt/prometheus/prometheus.yml and change 'YOUR_SERVER_IP:3000' to your actual server IP"
echo "2. Copy Grafana dashboard from monitoring/grafana/dashboards/getty-dashboard.json"
echo "3. Access Grafana at http://localhost:3000 (admin/admin)"
echo "4. Import the Getty dashboard"
echo
echo "Services status:"
systemctl status prometheus --no-pager -l
echo
systemctl status grafana-server --no-pager -l
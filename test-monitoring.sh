#!/bin/bash
echo "=== Getty Prometheus + Grafana Monitoring Setup Test ==="
echo

echo "1. Checking if Getty server is running..."
if netstat -ano | findstr :3000 > /dev/null; then
    echo "✓ Server is running on port 3000"
else
    echo "✗ Server is not running on port 3000"
    echo "Starting server..."
    cd /c/Users/mitni/Documents/Odysee/dev/push/getty
    node server.js &
    SERVER_PID=$!
    sleep 3
fi

echo
echo "2. Testing /metrics endpoint..."
if curl -s http://localhost:3000/metrics > /dev/null; then
    echo "✓ /metrics endpoint is responding"

    METRICS=$(curl -s http://localhost:3000/metrics)
    if echo "$METRICS" | findstr "websocket_connections_total" > /dev/null; then
        echo "✓ websocket_connections_total metric found"
    else
        echo "✗ websocket_connections_total metric not found"
    fi

    if echo "$METRICS" | findstr "tip_events_total" > /dev/null; then
        echo "✓ tip_events_total metric found"
    else
        echo "✗ tip_events_total metric not found"
    fi

    if echo "$METRICS" | findstr "arweave_gateway_errors_total" > /dev/null; then
        echo "✓ arweave_gateway_errors_total metric found"
    else
        echo "✗ arweave_gateway_errors_total metric not found"
    fi

    if echo "$METRICS" | findstr "http_requests_total" > /dev/null; then
        echo "✓ http_requests_total metric found"
    else
        echo "✗ http_requests_total metric not found"
    fi
else
    echo "✗ /metrics endpoint is not responding"
fi

echo
echo "3. Checking Docker monitoring setup..."
if [ -f "docker-compose.monitoring.yml" ]; then
    echo "✓ docker-compose.monitoring.yml exists"
else
    echo "✗ docker-compose.monitoring.yml not found"
fi

if [ -f "monitoring/prometheus.yml" ]; then
    echo "✓ monitoring/prometheus.yml exists"
else
    echo "✗ monitoring/prometheus.yml not found"
fi

if [ -d "monitoring/grafana" ]; then
    echo "✓ monitoring/grafana directory exists"
else
    echo "✗ monitoring/grafana directory not found"
fi

if [ -f "monitoring/grafana/dashboards/getty-dashboard.json" ]; then
    echo "✓ monitoring/grafana/dashboards/getty-dashboard.json exists"
else
    echo "✗ monitoring/grafana/dashboards/getty-dashboard.json not found"
fi

echo
echo "4. To start monitoring stack, run:"
echo "   docker-compose -f docker-compose.monitoring.yml up -d"
echo
echo "5. Access points:"
echo "   - Getty App: http://localhost:3000"
echo "   - Prometheus: http://localhost:9090"
echo "   - Grafana: http://localhost:3001 (admin/admin)"
echo
echo "6. Test metrics collection:"
echo "   - Open WebSocket connection to trigger websocket_connections_total"
echo "   - Send test tip via /api/chat/test-message to trigger tip_events_total"
echo "   - Check Grafana dashboard 'Getty Application Metrics' for visualization"
echo
echo "7. To stop monitoring stack:"
echo "   docker-compose -f docker-compose.monitoring.yml down"

if [ ! -z "$SERVER_PID" ]; then
    echo
    echo "Stopping test server..."
    kill $SERVER_PID 2>/dev/null
fi
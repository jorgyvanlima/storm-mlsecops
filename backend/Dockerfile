FROM python:3.10-slim

# Create a non-privileged user for security hardening
RUN useradd -u 10001 -m stormuser

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Adjust permissions
RUN chown -R stormuser:stormuser /app

# Use the non-root user
USER stormuser

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]

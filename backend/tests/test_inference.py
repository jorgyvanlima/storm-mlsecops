# backend/tests/test_inference.py
import pytest
import sys
import os

# Ensure backend folder is in path if run from within tests folder
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from main import app, calculate_neighborhood_floods_failsafe

client = TestClient(app)

def test_status_endpoint():
    response = client.get("/status")
    assert response.status_code == 200
    assert "fail_safe_mode_active" in response.json()

def test_failsafe_logic():
    # Testa os limites Pluviométricos de Belém-PA (Doca de Souza Franco) [121]
    # Limiar da Doca é 12.0 mm, drenagem 10% [121]
    results_dry = calculate_neighborhood_floods_failsafe(5.0)
    assert results_dry["Doca de Souza Franco"]["critical_warning"] == False
    
    results_flood = calculate_neighborhood_floods_failsafe(15.0)
    assert results_flood["Doca de Souza Franco"]["critical_warning"] == True
    assert results_flood["Doca de Souza Franco"]["probability"] > 50.0

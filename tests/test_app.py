import copy
import pytest

from httpx import AsyncClient

from src import app as app_module
from src.app import app, activities


@pytest.fixture(autouse=True)
def isolate_activities():
    """Backup and restore the in-memory activities dict around each test."""
    orig = copy.deepcopy(activities)
    try:
        yield
    finally:
        activities.clear()
        activities.update(orig)


@pytest.mark.asyncio
async def test_get_activities_returns_activities():
    async with AsyncClient(app=app, base_url="http://test") as client:
        r = await client.get("/activities")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, dict)
        # Expect at least one known activity from the sample data
        assert "Chess Club" in data


@pytest.mark.asyncio
async def test_signup_prevents_duplicate_and_respects_capacity():
    async with AsyncClient(app=app, base_url="http://test") as client:
        activity_name = "Tiny Club"
        # Insert a tiny activity with capacity 1 for testing
        activities[activity_name] = {
            "description": "Tiny",
            "schedule": "Now",
            "max_participants": 1,
            "participants": [],
        }

        email = "student@example.com"

        # First signup should succeed
        r1 = await client.post(f"/activities/{activity_name}/signup", params={"email": email})
        assert r1.status_code == 200
        assert email in activities[activity_name]["participants"]

        # Duplicate signup should be rejected
        r2 = await client.post(f"/activities/{activity_name}/signup", params={"email": email})
        assert r2.status_code == 400

        # Another signup should be rejected because capacity is 1
        r3 = await client.post(f"/activities/{activity_name}/signup", params={"email": "other@example.com"})
        assert r3.status_code == 400


@pytest.mark.asyncio
async def test_unregister_participant_and_errors():
    async with AsyncClient(app=app, base_url="http://test") as client:
        activity_name = "Chess Club"
        email = "tempuser@example.com"

        # Ensure participant exists (use signup endpoint)
        r_signup = await client.post(f"/activities/{activity_name}/signup", params={"email": email})
        assert r_signup.status_code == 200
        assert email in activities[activity_name]["participants"]

        # Unregister should succeed
        r_del = await client.delete(f"/activities/{activity_name}/participants", params={"email": email})
        assert r_del.status_code == 200
        assert email not in activities[activity_name]["participants"]

        # Deleting again should return 404
        r_del2 = await client.delete(f"/activities/{activity_name}/participants", params={"email": email})
        assert r_del2.status_code == 404

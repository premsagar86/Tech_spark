import { listEvents, getEventBySlug } from "../models/events.model.js";

export async function getEvents(req, res, next) {
  try {
    const events = await listEvents();
    res.set("Cache-Control", "public, max-age=60");
    res.json({ events });
  } catch (err) {
    next(err);
  }
}

export async function getEvent(req, res, next) {
  try {
    const event = await getEventBySlug(req.params.slug);
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json({ event });
  } catch (err) {
    next(err);
  }
}

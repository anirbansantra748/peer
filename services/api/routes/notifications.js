const express = require('express');
const Notification = require('../../../shared/models/Notification');
const logger = require('../../../shared/utils/prettyLogger');

const router = express.Router();

/**
 * Get unread notifications for current user
 */
router.get('/unread', async (req, res) => {
  try {
    const userId = req.query.userId;
    const since = req.query.since;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    // Build query
    const query = { userId, read: false };
    
    // Only return notifications created after 'since' timestamp
    if (since) {
      query.createdAt = { $gt: new Date(parseInt(since)) };
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Get total unread count
    const totalUnread = await Notification.countDocuments({ userId, read: false });

    logger.info('notifications', 'Fetched unread notifications', {
      userId,
      since: since ? new Date(parseInt(since)).toISOString() : 'none',
      returned: notifications.length,
      totalUnread
    });

    res.json({
      ok: true,
      notifications,
      count: totalUnread
    });
  } catch (error) {
    logger.error('api', 'Failed to fetch unread notifications', { error: String(error), stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * Get all notifications for current user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      Notification.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments({ userId })
    ]);

    res.json({
      ok: true,
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('api', 'Failed to fetch notifications', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * Mark notification as read
 */
router.post('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.body.userId;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const notification = await Notification.findOne({ _id: id, userId });
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await notification.markAsRead();

    res.json({ ok: true, notification });
  } catch (error) {
    logger.error('api', 'Failed to mark notification as read', { error: String(error) });
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

/**
 * Mark all notifications as read
 */
router.post('/read-all', async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const result = await Notification.updateMany(
      { userId, read: false },
      { $set: { read: true } }
    );

    res.json({ 
      ok: true, 
      updated: result.modifiedCount 
    });
  } catch (error) {
    logger.error('api', 'Failed to mark all notifications as read', { error: String(error) });
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

/**
 * Delete notification
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.query.userId;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const notification = await Notification.findOneAndDelete({ _id: id, userId });
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ ok: true });
  } catch (error) {
    logger.error('api', 'Failed to delete notification', { error: String(error) });
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

module.exports = router;

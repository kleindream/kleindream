-- Extra indexes for performance (KleinDream Pro Pack)
CREATE INDEX IF NOT EXISTS idx_profile_visits_visited ON profile_visits(visited_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id);

-- group_posts links to group_topics via topic_id (group_id is in group_topics)
CREATE INDEX IF NOT EXISTS idx_group_posts_topic ON group_posts(topic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_topics_group ON group_topics(group_id, created_at DESC);

create trigger trigger_remove_follows_on_block
after INSERT on blocked_users for EACH row
execute FUNCTION remove_follows_on_block ();

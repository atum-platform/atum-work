# Conversation relay threads

The conversation relay calls `t3_thread_launch` with `scratch: true` and
`hidden: true`. Scratch supplies the workspace. The optional visibility flag
is stored at creation and drives the lists shared by Work's desktop, web and
mobile clients. The thread keeps its ordinary runtime lifecycle and remains
addressable by ID under the caller's existing permissions. The flag is a
presentation setting.

Use the runtime with this launch option before rolling out the matching
relay client. Older threads retain their original visibility. Ordinary
delegation continues to use T3's task relationships and listing rules.

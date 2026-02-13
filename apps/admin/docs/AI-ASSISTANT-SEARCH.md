# AI Assistant Search Feature

## Overview

The AI Assistant now includes a **search feature** that allows users to search through their previous chat conversations across all tabs (Chat, Data, Spec).

## How It Works

### User Interface

**Location**: Search bar is located in the AI Assistant header, below the tab navigation

**Components**:
- Search input field with placeholder "Search previous chats..."
- Search button (🔍 Search) that triggers the search
- Clear button (✕ Clear) to exit search mode and return to regular chat

**Keyboard Shortcuts**:
- Press `Enter` in the search field to trigger search
- Click "Clear" or start a new chat to exit search mode

### Search Functionality

**What gets searched**:
- All previous AI interactions logged in the `AIInteractionLog` table
- Both user messages AND AI responses
- Case-insensitive full-text search

**Filtering**:
- Automatically filters by current tab context (e.g., "assistant.chat", "assistant.tasks")
- Shows up to 50 most recent matching results

**Search Results Display**:
- Shows total count of matching conversations
- For each result:
  - User message excerpt (if match found)
  - AI response excerpt (if match found)
  - Context preview (±100 characters around the match)
  - Timestamp of the conversation
  - Tab/mode badge showing where the conversation occurred
- Results sorted by most recent first

### Technical Implementation

**API Endpoint**: `/api/ai/assistant/search`

**Query Parameters**:
- `q` (required) - search query string
- `callPoint` (optional) - filter by call point (e.g., "assistant.chat")
- `limit` (optional) - max results, default 20, max 100
- `offset` (optional) - pagination offset, default 0

**Database Query**:
```typescript
// Searches both userMessage and aiResponse fields
WHERE (
  userMessage ILIKE '%query%' OR
  aiResponse ILIKE '%query%'
)
AND callPoint LIKE 'assistant.{tab}%'
ORDER BY createdAt DESC
```

**Component State**:
- `searchQuery` - current search input
- `searchResults` - array of matching conversations
- `isSearching` - loading state during API call
- `searchMode` - boolean flag to toggle between search results and regular chat

### User Experience Flow

1. **Enter search mode**:
   - User types query in search field
   - Presses Enter or clicks "Search" button
   - Panel switches to search mode

2. **View results**:
   - Results appear in message area
   - Shows count and excerpts with context
   - Empty state if no matches found

3. **Exit search mode**:
   - Click "Clear" button
   - Returns to regular chat view
   - Search query is cleared

### Integration Points

**Files Modified**:
- `components/shared/UnifiedAssistantPanel.tsx` - Added search UI and state
- `app/api/ai/assistant/search/route.ts` - New search API endpoint

**Database**:
- Uses existing `AIInteractionLog` table
- No schema changes required
- Leverages existing interaction logging system

## Usage Examples

**Example 1**: Find previous conversations about "specs"
```
Search: "how do I create a spec"
Results: Shows all past conversations where user asked about spec creation
```

**Example 2**: Find AI responses about "parameters"
```
Search: "parameter"
Results: Shows conversations where AI explained parameters
```

**Example 3**: Find conversations from specific dates
```
Search: [Any keyword]
Results: Include timestamps, can visually scan for date range
```

## Future Enhancements

Potential improvements:
- Add date range filters
- Add search across all tabs (not just current tab)
- Highlight exact match terms in results
- Add "Load conversation" button to restore full context
- Add search history/suggestions
- Add advanced filters (outcome type, metadata fields)
- Add export search results functionality

## Notes

- Search is scoped to the current tab by default (chat/data/spec)
- Tasks tab doesn't have search (it shows active tasks only)
- Search results show excerpts, not full messages
- All searches are logged for AI learning and improvement

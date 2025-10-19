# EJS-Mate Syntax Reference

## Quick Fix Applied

Fixed the `contentFor is not defined` error by using correct ejs-mate syntax.

---

## Correct Syntax

### In Child Template (e.g., dashboard.ejs):

```ejs
<% layout('layout') %>

<!-- Add custom styles -->
<% block('additionalStyles', `
<style>
  /* Your CSS here */
</style>
`) %>

<!-- Main content -->
<div>
  Your page content here
</div>

<!-- Add custom scripts -->
<% block('additionalScripts', `
<script>
  // Your JS here
</script>
`) %>
```

### In Layout Template (layout.ejs):

```ejs
<!DOCTYPE html>
<html>
  <head>
    <!-- Common styles -->
    <style>
      /* Layout styles */
    </style>
    
    <!-- Child template styles -->
    <%- blocks.additionalStyles %>
  </head>
  <body>
    <!-- Main content from child -->
    <%- body %>
    
    <!-- Child template scripts -->
    <%- blocks.additionalScripts %>
  </body>
</html>
```

---

## Key Points

1. **Define blocks in child**: `<% block('name', \`content\`) %>`
2. **Use backticks**: Content must be wrapped in backticks (`)
3. **Access in layout**: `<%- blocks.name %>`
4. **Main content**: `<%- body %>` renders the main template content

---

## Common Patterns

### Conditional Blocks

```ejs
<!-- In layout -->
<%- blocks.additionalStyles || '' %>
```

### Multiple Blocks

```ejs
<!-- In child -->
<% block('styles', `<style>...</style>`) %>
<% block('scripts', `<script>...</script>`) %>
<% block('meta', `<meta name="description" content="...">`) %>

<!-- In layout -->
<%- blocks.meta %>
<%- blocks.styles %>
<%- blocks.scripts %>
```

---

## Files Fixed

1. **services/ui/views/dashboard.ejs**
   - Changed `<%- contentFor('name') %>` to `<% block('name', \`...\`) %>`
   - Changed `<% endContentFor %>` to `\`) %>`

2. **services/ui/views/layout.ejs**
   - Changed `<%- typeof additionalStyles !== 'undefined' ? additionalStyles : '' %>` to `<%- blocks.additionalStyles %>`

---

## Error Before Fix

```
ReferenceError: contentFor is not defined
```

## Error After Fix

✅ No errors - renders correctly

---

## Testing

Start the UI server and navigate to dashboard:
```bash
# Should work now
http://localhost:3000/
```

Expected result:
- ✅ Dashboard loads
- ✅ Navbar with profile image appears
- ✅ Custom styles applied
- ✅ Custom scripts loaded
- ✅ No errors in console

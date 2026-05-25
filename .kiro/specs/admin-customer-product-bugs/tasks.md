# Implementation Plan

## Bug 1 — Tanggal Bergabung Customer (Invalid Date)

- [x] 1. Write bug condition exploration test for Bug 1
  - **Property 1: Bug Condition** - Invalid Date on Customer Join Date
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to customer objects with valid `created_at` but undefined `createdAt`
  - Test that `CustomersSection` renders "Invalid Date" when accessing `u.createdAt` on objects with only `created_at` field (from Bug Condition in design: `customerObject.createdAt === undefined AND customerObject.created_at !== undefined`)
  - The test assertions should match the Expected Behavior Properties from design: valid formatted date like "7 Mei 2025"
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found (e.g., `{ created_at: "2025-05-07T10:00:00.000Z" }` renders "Invalid Date" instead of "7 Mei 2025")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2_

- [x] 2. Write preservation property tests for Bug 1 (BEFORE implementing fix)
  - **Property 2: Preservation** - Customer Columns Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy columns (Name, Email, Phone)
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements (3.1, 3.2, 3.3)
  - Property-based testing generates many test cases for stronger guarantees
  - Test that Name, Email, Phone columns render correctly for all customer objects
  - Test that search functionality filters customers correctly
  - Test that pagination displays correct pages
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. Fix for Invalid Date on Customer Join Date

  - [x] 3.1 Implement the fix in CustomersSection.jsx
    - Change `u.createdAt` to `u.created_at` in the date column render
    - Add null/undefined guard: `u.created_at ? new Date(u.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'`
    - File: `src/components/pages/admin/sections/CustomersSection.jsx`
    - _Bug_Condition: isBugCondition_Bug1(customerObject) where customerObject.createdAt === undefined AND customerObject.created_at !== undefined_
    - _Expected_Behavior: Display formatted date like "7 Mei 2025" using toLocaleDateString('id-ID')_
    - _Preservation: Name, Email, Phone columns and search/pagination functionality must remain unchanged_
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Valid Date Display
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Customer Columns Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 4. Checkpoint - Ensure all Bug 1 tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Bug 2 — Input Gambar Produk (Missing Image Input)

- [x] 5. Write bug condition exploration test for Bug 2
  - **Property 1: Bug Condition** - Missing Image Input in Product Form
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to form states with no image input rendered
  - Test that `ProductModal` does NOT render `<input type="file">` for images (from Bug Condition in design: `noImageInputRenderedInForm()`)
  - Test that form submit sends hardcoded placeholder `/assets/img/placeholder.svg` instead of user-provided images
  - The test assertions should match the Expected Behavior Properties from design: image input exists, validation works, images are saved
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found (e.g., "No file input found in ProductModal", "Submit sends placeholder instead of user images")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.3, 1.4, 1.5_

- [x] 6. Write preservation property tests for Bug 2 (BEFORE implementing fix)
  - **Property 2: Preservation** - Product Fields Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-image fields (Name, Category, Price, Description, Variants, etc.)
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements (3.4, 3.5, 3.6, 3.7)
  - Property-based testing generates many test cases for stronger guarantees
  - Test that all non-image fields (Name, Category, Price, Description, Colors, Sizes, Materials, Variant Prices, Requires Design) save correctly
  - Test that product delete functionality works correctly
  - Test that product display in public catalog works correctly
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.4, 3.5, 3.6, 3.7_

- [x] 7. Fix for Missing Image Input in Product Form

  - [x] 7.1 Add image state and parsing logic to ProductModal
    - Add `parseImages(product)` function to parse existing images from product (handles JSON array or single string)
    - Add state: `const [images, setImages] = useState(parseImages(product))`
    - Add state: `const [imageError, setImageError] = useState('')`
    - File: `src/components/pages/admin/sections/ProductsSection.jsx`
    - _Bug_Condition: isBugCondition_Bug2(formState) where formState.images === undefined OR formState.images.length === 0_
    - _Expected_Behavior: Image input exists, supports 1-8 photos, validates minimum 1 photo required_
    - _Preservation: All non-image fields must save correctly_
    - _Requirements: 1.3, 1.4, 2.3, 2.4, 3.4, 3.5_

  - [x] 7.2 Add image upload and remove handlers
    - Implement `handleImageUpload(e)` to handle file selection
    - Validate maximum 8 photos, show error if exceeded
    - Use `URL.createObjectURL` for preview (or upload to server immediately)
    - Implement `handleRemoveImage(idx)` to remove image from array
    - File: `src/components/pages/admin/sections/ProductsSection.jsx`
    - _Requirements: 2.3, 2.4, 2.6_

  - [x] 7.3 Add image validation in handleSubmit
    - Add validation: `if (images.length === 0) { setFormError('Minimal 1 gambar produk wajib diunggah.'); return; }`
    - Update submit data to include: `image: JSON.stringify(images)`
    - File: `src/components/pages/admin/sections/ProductsSection.jsx`
    - _Requirements: 2.5, 2.7_

  - [x] 7.4 Add image input UI to form
    - Render image preview grid showing existing images with remove buttons
    - Render `<input type="file" accept="image/jpeg,image/png,image/webp" multiple>` when images.length < 8
    - Add label: "Foto Produk * (minimal 1, maksimal 8)"
    - Display `imageError` message if validation fails
    - Place before `requiresDesign` field in form
    - File: `src/components/pages/admin/sections/ProductsSection.jsx`
    - _Requirements: 2.3, 2.4, 2.6_

  - [x] 7.5 Update normalizeProduct to handle image array format
    - Update `normalizeProduct` in `productService.js` to parse `image_path` as JSON array if applicable
    - Use first image in array as primary image for backward compatibility
    - Ensure public catalog components can display images correctly
    - Files: `src/services/productService.js`, potentially `src/components/ProductCard.jsx` and `src/components/pages/public/CatalogProductPage.jsx`
    - _Requirements: 2.7, 3.7_

  - [x] 7.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Image Input Available
    - **IMPORTANT**: Re-run the SAME test from task 5 - do NOT write a new test
    - The test from task 5 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 5
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 7.7 Verify preservation tests still pass
    - **Property 2: Preservation** - Product Fields Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 6 - do NOT write new tests
    - Run preservation property tests from step 6
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.4, 3.5, 3.6, 3.7_

- [x] 8. Checkpoint - Ensure all Bug 2 tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Final Verification

- [x] 9. Integration testing
  - Test full flow: Load Customer page → verify join dates display correctly
  - Test full flow: Search customers → verify join dates in results
  - Test full flow: Add new product with images → verify product appears with images in catalog
  - Test full flow: Edit existing product → change images → verify new images display
  - Test full flow: Try to save product without images → verify validation error appears
  - Test full flow: Try to upload 9 images → verify error message about maximum limit

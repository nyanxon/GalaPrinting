/**
 * adminProductBugCondition.property.test.jsx
 *
 * Bug condition exploration test for Bug 2 — Input Gambar Produk (Missing Image Input).
 *
 * **CRITICAL**: This test is EXPECTED TO FAIL on unfixed code.
 * Failure confirms the bug exists. DO NOT fix the code or the test when it fails.
 *
 * Bug Condition (from design.md):
 *   FUNCTION isBugCondition_Bug2(formState)
 *     RETURN formState.images === undefined OR formState.images.length === 0
 *            AND formState.submittedImage === '/assets/img/placeholder.svg'
 *            AND noImageInputRenderedInForm()
 *   END FUNCTION
 *
 * Root cause: ProductModal has NO state for images and NO <input type="file">
 * in its JSX. In handleSubmit, the image is hardcoded:
 *   image: product?.image || product?.image_path || '/assets/img/placeholder.svg'
 * For a new product (no `product` prop), this always sends '/assets/img/placeholder.svg'.
 *
 * **Validates: Requirements 1.3, 1.4, 1.5**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

// ─────────────────────────────────────────────────────────────────────────────
// Mock all service/utility dependencies so ProductsSection doesn't make
// real HTTP calls or trigger side effects.
// ─────────────────────────────────────────────────────────────────────────────
vi.mock('../services/productService.js', () => ({
  addProduct: vi.fn(),
  updateProduct: vi.fn(),
  listProductsPaginated: vi.fn(),
  listCategories: vi.fn(),
  deleteProduct: vi.fn(),
}));

vi.mock('../services/categoryService.js', () => ({
  createCategory: vi.fn(),
}));

vi.mock('../core/validate.js', () => ({
  validateProduct: vi.fn(() => ({ ok: true, errors: [] })),
  normalizePagination: vi.fn((opts) => ({
    page: opts?.page ?? 1,
    limit: opts?.limit ?? 10,
  })),
}));

vi.mock('../core/toastEmitter.js', () => ({
  showToast: vi.fn(),
}));

vi.mock('../core/helpers.js', () => ({
  formatCurrency: vi.fn((v) => String(v)),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Import mocked services and the component under test.
// ProductModal is NOT exported separately — it lives inside ProductsSection.
// We render ProductsSection and click "+ Tambah" to open the modal.
// ─────────────────────────────────────────────────────────────────────────────
import {
  listProductsPaginated,
  listCategories,
  addProduct,
} from '../services/productService.js';
import ProductsSection from '../components/pages/admin/sections/ProductsSection.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// Default mock return values for data loading
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_CATEGORIES = ['Stiker', 'Brosur', 'Kartu Nama'];

const MOCK_PAGINATED_RESULT = {
  items: [],
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 1,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: render ProductsSection, wait for data to load, then click "+ Tambah"
// to open the ProductModal in add mode (no product prop).
// ─────────────────────────────────────────────────────────────────────────────
async function renderAndOpenAddModal() {
  listCategories.mockResolvedValue(MOCK_CATEGORIES);
  listProductsPaginated.mockResolvedValue(MOCK_PAGINATED_RESULT);

  const result = render(<ProductsSection />);

  // Wait for the component to finish loading data
  await waitFor(() => {
    expect(listCategories).toHaveBeenCalled();
  });

  // Click the "+ Tambah" button to open the modal in add mode
  const addButton = screen.getByRole('button', { name: /\+ Tambah/i });
  await act(async () => {
    fireEvent.click(addButton);
  });

  // Wait for the modal to appear — use the modal title heading specifically
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Tambah Produk' })).toBeTruthy();
  });

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reset mocks before each test
// ─────────────────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Bug Condition Tests: Missing Image Input in ProductModal
// ─────────────────────────────────────────────────────────────────────────────
describe('Bug 2 — Input Gambar Produk: Bug Condition Exploration', () => {
  /**
   * Test 1: ProductModal (add mode) must render an <input type="file"> for images.
   *
   * EXPECTED ON UNFIXED CODE: No <input type="file"> exists → test FAILS (confirms bug)
   * EXPECTED ON FIXED CODE:   <input type="file"> exists → test PASSES (confirms fix)
   *
   * Counterexample: "No file input found in ProductModal"
   *
   * **Validates: Requirements 1.3, 1.4**
   */
  it('ProductModal (add mode) must render an <input type="file"> for image upload', async () => {
    const { unmount } = await renderAndOpenAddModal();

    // Assert: a file input must exist in the modal
    // On UNFIXED code: no <input type="file"> exists → this assertion FAILS (confirms bug)
    // On FIXED code:   <input type="file"> exists → this assertion PASSES
    const fileInputs = document.querySelectorAll('input[type="file"]');
    expect(fileInputs.length).toBeGreaterThan(0); // FAILS on unfixed code

    unmount();
  });

  /**
   * Test 2: Submitting the form without providing images must NOT send
   * the hardcoded placeholder '/assets/img/placeholder.svg' as the image.
   *
   * On unfixed code, addProduct is called with image: '/assets/img/placeholder.svg'
   * because the image is hardcoded in handleSubmit.
   *
   * EXPECTED ON UNFIXED CODE: addProduct called with placeholder → test FAILS (confirms bug)
   * EXPECTED ON FIXED CODE:   addProduct NOT called (validation blocks it) → test PASSES
   *
   * Counterexample: "Submit sends placeholder instead of user images"
   *
   * **Validates: Requirements 1.5**
   */
  it('submitting the form without images must NOT call addProduct with the hardcoded placeholder', async () => {
    addProduct.mockResolvedValue({ id: 'new-product-id', name: 'Test Produk' });

    const { unmount } = await renderAndOpenAddModal();

    // Fill in the required fields (name, category, price) but provide NO image
    const nameInput = screen.getByPlaceholderText('Nama produk');
    fireEvent.change(nameInput, { target: { value: 'Test Produk' } });

    // Use the id to target the modal's category select (not the toolbar filter)
    const categorySelect = document.getElementById('pf-cat');
    fireEvent.change(categorySelect, { target: { value: 'Stiker' } });

    const priceInput = screen.getByPlaceholderText('0');
    fireEvent.change(priceInput, { target: { value: '50000' } });

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /Tambah Produk/i });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    // Wait for any async operations to settle
    await waitFor(() => {
      // On UNFIXED code: addProduct IS called (no image validation exists)
      // The submitted data will have image: '/assets/img/placeholder.svg'
      // We assert the EXPECTED behavior: addProduct should NOT be called with placeholder
      if (addProduct.mock.calls.length > 0) {
        // If addProduct was called, the image must NOT be the hardcoded placeholder
        // On UNFIXED code: image IS the placeholder → this assertion FAILS (confirms bug)
        const submittedData = addProduct.mock.calls[0][0];
        expect(submittedData.image).not.toBe('/assets/img/placeholder.svg'); // FAILS on unfixed code
      } else {
        // addProduct was not called — this means validation blocked the submit
        // This is the CORRECT behavior on fixed code (no image → validation error)
        expect(addProduct).not.toHaveBeenCalled();
      }
    });

    unmount();
  });
});

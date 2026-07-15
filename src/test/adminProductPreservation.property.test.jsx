/**
 * adminProductPreservation.property.test.jsx
 *
 * Preservation property tests for Bug 2 - Input Gambar Produk (Missing Image Input).
 *
 * IMPORTANT: These tests follow the observation-first methodology.
 * They MUST PASS on UNFIXED code -- they establish the baseline behavior
 * to preserve after the fix is applied.
 *
 * These tests verify that non-image fields (Name, Category, Price, Description,
 * Colors, Sizes, Materials, Variant Prices, Requires Design), delete functionality,
 * and product display in the list continue to work correctly both before and
 * after the Bug 2 fix.
 *
 * Validates: Requirements 3.4, 3.5, 3.6, 3.7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Mock all service/utility dependencies so ProductsSection does not make
// real HTTP calls or trigger side effects.
// ---------------------------------------------------------------------------
vi.mock('../services/products.js', () => ({
  addProduct: vi.fn(),
  updateProduct: vi.fn(),
  listProductsPaginated: vi.fn(),
  listCategories: vi.fn(),
  deleteProduct: vi.fn(),
}));

vi.mock('../services/categories.js', () => ({
  createCategory: vi.fn(),
}));

vi.mock('../utils/validate.js', () => ({
  validateProduct: vi.fn(() => ({ ok: true, errors: [] })),
}));

vi.mock('../core/toastEmitter.js', () => ({
  showToast: vi.fn(),
}));

vi.mock('../utils/format.js', () => ({
  formatCurrency: vi.fn((v) => String(v)),
}));

// ---------------------------------------------------------------------------
// Import mocked services and the component under test.
// ---------------------------------------------------------------------------
import {
  listProductsPaginated,
  listCategories,
  addProduct,
  deleteProduct,
} from '../services/products.js';
import ProductsSection from '../components/pages/admin/sections/ProductsSection.jsx';

// ---------------------------------------------------------------------------
// Default mock return values
// ---------------------------------------------------------------------------
const MOCK_CATEGORIES = ['Stiker', 'Brosur', 'Kartu Nama'];

function makePaginatedResult(items = [], total = null) {
  const t = total !== null ? total : items.length;
  return {
    items,
    total: t,
    page: 1,
    limit: 10,
    totalPages: Math.max(1, Math.ceil(t / 10)),
  };
}

// ---------------------------------------------------------------------------
// Arbitrary: generates valid product form data (non-image fields only).
// These are the fields that must be preserved after the Bug 2 fix.
// ---------------------------------------------------------------------------
const productFormArbitrary = fc.record({
  name: fc
    .string({ minLength: 1, maxLength: 60 })
    .map((s) => s.trim())
    .filter((s) => s.length > 0),
  category: fc.constantFrom('Stiker', 'Brosur', 'Kartu Nama'),
  price: fc.integer({ min: 1000, max: 10000000 }),
  shortDescription: fc.string({ minLength: 0, maxLength: 200 }),
  colors: fc.array(fc.constantFrom('Hitam', 'Putih', 'Merah', 'Biru', 'Hijau'), { minLength: 0, maxLength: 4 }),
  sizes: fc.array(fc.constantFrom('A4', 'A5', 'A6', 'Custom'), { minLength: 0, maxLength: 3 }),
  materials: fc.array(fc.constantFrom('Vinyl', 'Art Paper', 'Glossy'), { minLength: 0, maxLength: 3 }),
  requiresDesign: fc.boolean(),
});

// ---------------------------------------------------------------------------
// Arbitrary: generates a product as returned by the API (list item shape).
// ---------------------------------------------------------------------------
const productListItemArbitrary = fc.record({
  id: fc.uuid(),
  name: fc
    .string({ minLength: 1, maxLength: 60 })
    .map((s) => s.trim())
    .filter((s) => s.length > 0),
  category: fc.constantFrom('Stiker', 'Brosur', 'Kartu Nama'),
  price: fc.integer({ min: 1000, max: 10000000 }),
  image: fc.constantFrom('/assets/img/placeholder.svg', '/assets/img/product1.jpg'),
});

// ---------------------------------------------------------------------------
// Helper: render ProductsSection and wait for data to load.
// ---------------------------------------------------------------------------
async function renderProductsSection(items = [], total = null) {
  listCategories.mockResolvedValue(MOCK_CATEGORIES);
  listProductsPaginated.mockResolvedValue(makePaginatedResult(items, total));

  const result = render(<ProductsSection />);

  await waitFor(() => {
    expect(listCategories).toHaveBeenCalled();
  });

  return result;
}

// ---------------------------------------------------------------------------
// Helper: open the add modal by clicking "+ Tambah".
// ---------------------------------------------------------------------------
async function openAddModal() {
  const addButton = screen.getByRole('button', { name: /\+ Tambah/i });
  await act(async () => {
    fireEvent.click(addButton);
  });
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Tambah Produk' })).toBeTruthy();
  });
}

// ---------------------------------------------------------------------------
// Helper: fill in the product form with the given data and submit.
// Returns the data that was submitted to addProduct.
// ---------------------------------------------------------------------------
async function fillAndSubmitForm(formData) {
  addProduct.mockResolvedValue({ id: 'new-id', ...formData });

  const nameInput = screen.getByPlaceholderText('Nama produk');
  fireEvent.change(nameInput, { target: { value: formData.name } });

  const categorySelect = document.getElementById('pf-cat');
  fireEvent.change(categorySelect, { target: { value: formData.category } });

  const priceInput = screen.getByPlaceholderText('0');
  fireEvent.change(priceInput, { target: { value: String(formData.price) } });

  if (formData.shortDescription) {
    const descInput = screen.getByPlaceholderText('Deskripsi singkat');
    fireEvent.change(descInput, { target: { value: formData.shortDescription } });
  }

  if (formData.colors && formData.colors.length > 0) {
    const colorsInput = screen.getByPlaceholderText('Hitam, Putih, Merah');
    fireEvent.change(colorsInput, { target: { value: formData.colors.join(', ') } });
  }

  if (formData.sizes && formData.sizes.length > 0) {
    const sizesInput = screen.getByPlaceholderText('A4, A5, Custom');
    fireEvent.change(sizesInput, { target: { value: formData.sizes.join(', ') } });
  }

  if (formData.materials && formData.materials.length > 0) {
    const matsInput = screen.getByPlaceholderText('Vinyl, Art Paper');
    fireEvent.change(matsInput, { target: { value: formData.materials.join(', ') } });
  }

  if (formData.requiresDesign) {
    const checkbox = document.querySelector('input[name="requiresDesign"]');
    if (checkbox && !checkbox.checked) {
      fireEvent.click(checkbox);
    }
  }

  // Simulate adding a mock image so the image validation passes.
  // The fix requires images.length > 0 before submitting.
  if (typeof URL.createObjectURL !== 'function') {
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: vi.fn(() => 'blob:mock-url'),
    });
  } else {
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  }

  const fileInput = document.querySelector('input[type="file"][aria-label="Upload foto produk"]');
  if (fileInput) {
    const mockFile = new File(['mock'], 'mock.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
  }

  const submitButton = screen.getByRole('button', { name: /Tambah Produk/i });
  await act(async () => {
    fireEvent.click(submitButton);
  });

  await waitFor(() => {
    expect(addProduct).toHaveBeenCalled();
  });

  return addProduct.mock.calls[0][0];
}

// ---------------------------------------------------------------------------
// Reset mocks before each test
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Requirement 3.4 -- Form displays all non-image fields
// ---------------------------------------------------------------------------
describe('Preservation 3.4 -- Form displays Name, Category, Price, Description, Colors, Sizes, Materials, Variant Prices, Requires Design', () => {
  /**
   * Concrete test: add modal renders all required non-image form fields.
   *
   * Validates: Requirements 3.4
   */
  it('add modal renders all non-image form fields', async () => {
    const { unmount } = await renderProductsSection();
    await openAddModal();

    // Name field
    expect(screen.getByLabelText(/Nama Produk/i)).toBeTruthy();

    // Category field — use the form's select by its id to avoid ambiguity with the toolbar filter
    expect(document.getElementById('pf-cat')).toBeTruthy();

    // Price field
    expect(screen.getByLabelText(/Harga Dasar/i)).toBeTruthy();

    // Description field
    expect(screen.getByLabelText(/Deskripsi Singkat/i)).toBeTruthy();

    // Colors field
    expect(screen.getByLabelText(/Warna/i)).toBeTruthy();

    // Sizes field
    expect(screen.getByLabelText(/Ukuran/i)).toBeTruthy();

    // Materials field
    expect(screen.getByLabelText(/Bahan/i)).toBeTruthy();

    // Requires Design checkbox
    expect(screen.getByText(/Wajib upload desain/i)).toBeTruthy();

    unmount();
  });

  /**
   * Concrete test: edit modal pre-fills all non-image fields from existing product.
   *
   * Validates: Requirements 3.4
   */
  it('edit modal pre-fills all non-image fields from existing product', async () => {
    const existingProduct = {
      id: 'prod-1',
      name: 'Stiker Custom',
      category: 'Stiker',
      price: 25000,
      shortDescription: 'Stiker berkualitas tinggi',
      colors: ['Hitam', 'Putih'],
      sizes: ['A4', 'A5'],
      materials: ['Vinyl'],
      requiresDesign: true,
      image: '/assets/img/placeholder.svg',
    };

    const { unmount } = await renderProductsSection([existingProduct]);

    // Click Edit button
    const editButton = screen.getByRole('button', { name: /Edit/i });
    await act(async () => {
      fireEvent.click(editButton);
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit Produk' })).toBeTruthy();
    });

    // Verify pre-filled values
    const nameInput = screen.getByPlaceholderText('Nama produk');
    expect(nameInput.value).toBe('Stiker Custom');

    const priceInput = screen.getByPlaceholderText('0');
    expect(priceInput.value).toBe('25000');

    const descInput = screen.getByPlaceholderText('Deskripsi singkat');
    expect(descInput.value).toBe('Stiker berkualitas tinggi');

    const colorsInput = screen.getByPlaceholderText('Hitam, Putih, Merah');
    expect(colorsInput.value).toContain('Hitam');

    const checkbox = document.querySelector('input[name="requiresDesign"]');
    expect(checkbox.checked).toBe(true);

    unmount();
  });
});

// ---------------------------------------------------------------------------
// Requirement 3.5 -- Saving product preserves all non-image fields
// ---------------------------------------------------------------------------
describe('Preservation 3.5 -- Saving product saves all non-image fields correctly', () => {
  /**
   * Concrete test: submitting the form sends all non-image fields to addProduct.
   *
   * Validates: Requirements 3.5
   */
  it('form submit sends name, category, price, description, colors, sizes, materials, requiresDesign to addProduct', async () => {
    const { unmount } = await renderProductsSection();
    await openAddModal();

    const submitted = await fillAndSubmitForm({
      name: 'Brosur Lipat',
      category: 'Brosur',
      price: 75000,
      shortDescription: 'Brosur lipat tiga',
      colors: ['Hitam', 'Putih'],
      sizes: ['A4'],
      materials: ['Art Paper'],
      requiresDesign: false,
    });

    // Verify all non-image fields are present in the submitted data
    expect(submitted.name).toBe('Brosur Lipat');
    expect(submitted.category).toBe('Brosur');
    expect(submitted.price).toBe(75000);
    expect(submitted.shortDescription).toBe('Brosur lipat tiga');
    expect(submitted.colors).toEqual(['Hitam', 'Putih']);
    expect(submitted.sizes).toEqual(['A4']);
    expect(submitted.materials).toEqual(['Art Paper']);
    expect(submitted.requiresDesign).toBe(false);

    unmount();
  });

  /**
   * Concrete test: requiresDesign=true is saved correctly.
   *
   * Validates: Requirements 3.5
   */
  it('requiresDesign=true is saved correctly', async () => {
    const { unmount } = await renderProductsSection();
    await openAddModal();

    const submitted = await fillAndSubmitForm({
      name: 'Kartu Nama Premium',
      category: 'Kartu Nama',
      price: 50000,
      shortDescription: '',
      colors: [],
      sizes: [],
      materials: [],
      requiresDesign: true,
    });

    expect(submitted.requiresDesign).toBe(true);

    unmount();
  });

  /**
   * Property: for any valid product form data, all non-image fields are
   * always submitted correctly to addProduct.
   *
   * Validates: Requirements 3.5
   */
  it('property: all non-image fields are always submitted correctly for any valid product data', async () => {
    const testCases = fc.sample(productFormArbitrary, 5);

    for (const formData of testCases) {
      vi.clearAllMocks();
      listCategories.mockResolvedValue(MOCK_CATEGORIES);
      listProductsPaginated.mockResolvedValue(makePaginatedResult());
      addProduct.mockResolvedValue({ id: 'new-id' });

      const { unmount } = render(<ProductsSection />);

      await waitFor(() => {
        expect(listCategories).toHaveBeenCalled();
      });

      await openAddModal();

      const submitted = await fillAndSubmitForm(formData);

      // Name must match
      expect(submitted.name).toBe(formData.name.trim());

      // Category must match
      expect(submitted.category).toBe(formData.category);

      // Price must be a number matching the input
      expect(submitted.price).toBe(Number(formData.price));

      // requiresDesign must match
      expect(submitted.requiresDesign).toBe(formData.requiresDesign);

      unmount();
    }
  });

  /**
   * Concrete test: variant prices are saved correctly when sizes and materials are set.
   *
   * Validates: Requirements 3.5
   */
  it('variant prices are saved correctly when sizes and materials are provided', async () => {
    const { unmount } = await renderProductsSection();
    await openAddModal();

    // Fill name, category, price
    fireEvent.change(screen.getByPlaceholderText('Nama produk'), { target: { value: 'Stiker Varian' } });
    fireEvent.change(document.getElementById('pf-cat'), { target: { value: 'Stiker' } });
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '10000' } });

    // Set sizes and materials to trigger variant price grid
    fireEvent.change(screen.getByPlaceholderText('A4, A5, Custom'), { target: { value: 'A4, A5' } });
    fireEvent.change(screen.getByPlaceholderText('Vinyl, Art Paper'), { target: { value: 'Vinyl' } });

    // Wait for variant price grid to appear
    await waitFor(() => {
      expect(screen.getByText('Harga per Varian')).toBeTruthy();
    });

    // Fill in a variant price
    const variantInputs = document.querySelectorAll('input[type="number"][aria-label]');
    const a4VinylInput = Array.from(variantInputs).find(
      (el) => el.getAttribute('aria-label') === 'Harga A4 / Vinyl'
    );
    if (a4VinylInput) {
      fireEvent.change(a4VinylInput, { target: { value: '15000' } });
    }

    addProduct.mockResolvedValue({ id: 'new-id' });

    // Simulate adding a mock image so the image validation passes.
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    const fileInput = document.querySelector('input[type="file"][aria-label="Upload foto produk"]');
    if (fileInput) {
      const mockFile = new File(['mock'], 'mock.jpg', { type: 'image/jpeg' });
      fireEvent.change(fileInput, { target: { files: [mockFile] } });
    }

    const submitButton = screen.getByRole('button', { name: /Tambah Produk/i });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(addProduct).toHaveBeenCalled();
    });

    const submitted = addProduct.mock.calls[0][0];
    expect(submitted.sizes).toEqual(['A4', 'A5']);
    expect(submitted.materials).toEqual(['Vinyl']);

    // If variant price was set, it should be in variantPrices
    if (a4VinylInput) {
      expect(submitted.variantPrices).toBeTruthy();
      expect(submitted.variantPrices['A4|Vinyl']).toBe(15000);
    }

    unmount();
  });
});

// ---------------------------------------------------------------------------
// Requirement 3.6 -- Delete product removes it from the list
// ---------------------------------------------------------------------------
describe('Preservation 3.6 -- Delete product removes it from the list', () => {
  /**
   * Concrete test: clicking Hapus calls deleteProduct with the correct id.
   *
   * Validates: Requirements 3.6
   */
  it('clicking Hapus calls deleteProduct with the correct product id', async () => {
    const product = {
      id: 'prod-to-delete',
      name: 'Produk Hapus',
      category: 'Stiker',
      price: 10000,
      image: '/assets/img/placeholder.svg',
    };

    deleteProduct.mockResolvedValue({ ok: true });

    // Mock window.confirm to return true
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { unmount } = await renderProductsSection([product]);

    const deleteButton = screen.getByRole('button', { name: /Hapus/i });
    await act(async () => {
      fireEvent.click(deleteButton);
    });

    await waitFor(() => {
      expect(deleteProduct).toHaveBeenCalledWith('prod-to-delete');
    });

    confirmSpy.mockRestore();
    unmount();
  });

  /**
   * Concrete test: after delete, the product list is refreshed.
   *
   * Validates: Requirements 3.6
   */
  it('after delete, loadData is called again to refresh the list', async () => {
    const product = {
      id: 'prod-refresh',
      name: 'Produk Refresh',
      category: 'Brosur',
      price: 20000,
      image: '/assets/img/placeholder.svg',
    };

    deleteProduct.mockResolvedValue({ ok: true });

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { unmount } = await renderProductsSection([product]);

    // listProductsPaginated was called once on mount
    const callCountBefore = listProductsPaginated.mock.calls.length;

    const deleteButton = screen.getByRole('button', { name: /Hapus/i });
    await act(async () => {
      fireEvent.click(deleteButton);
    });

    await waitFor(() => {
      // listProductsPaginated should be called again after delete
      expect(listProductsPaginated.mock.calls.length).toBeGreaterThan(callCountBefore);
    });

    confirmSpy.mockRestore();
    unmount();
  });

  /**
   * Concrete test: cancelling the confirm dialog does NOT call deleteProduct.
   *
   * Validates: Requirements 3.6
   */
  it('cancelling the confirm dialog does NOT delete the product', async () => {
    const product = {
      id: 'prod-cancel',
      name: 'Produk Cancel',
      category: 'Stiker',
      price: 15000,
      image: '/assets/img/placeholder.svg',
    };

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const { unmount } = await renderProductsSection([product]);

    const deleteButton = screen.getByRole('button', { name: /Hapus/i });
    await act(async () => {
      fireEvent.click(deleteButton);
    });

    expect(deleteProduct).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
    unmount();
  });

  /**
   * Property: for any product in the list, clicking Hapus and confirming
   * always calls deleteProduct with that product's id.
   *
   * Validates: Requirements 3.6
   */
  it('property: delete always calls deleteProduct with the correct id for any product', async () => {
    const testProducts = fc.sample(productListItemArbitrary, 3);

    for (const product of testProducts) {
      vi.clearAllMocks();
      listCategories.mockResolvedValue(MOCK_CATEGORIES);
      listProductsPaginated.mockResolvedValue(makePaginatedResult([product]));
      deleteProduct.mockResolvedValue({ ok: true });

      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      const { unmount } = render(<ProductsSection />);

      await waitFor(() => {
        expect(screen.getByText(product.name)).toBeTruthy();
      });

      const deleteButton = screen.getByRole('button', { name: /Hapus/i });
      await act(async () => {
        fireEvent.click(deleteButton);
      });

      await waitFor(() => {
        expect(deleteProduct).toHaveBeenCalledWith(product.id);
      });

      confirmSpy.mockRestore();
      unmount();
    }
  });
});

// ---------------------------------------------------------------------------
// Requirement 3.7 -- Product list displays products with correct data
// ---------------------------------------------------------------------------
describe('Preservation 3.7 -- Product list displays products with correct data', () => {
  /**
   * Concrete test: product list shows Name, Category, and Price for each product.
   *
   * Validates: Requirements 3.7
   */
  it('product list shows Name, Category, and Price for each product', async () => {
    const products = [
      { id: '1', name: 'Stiker Bulat', category: 'Stiker', price: 5000, image: '/assets/img/placeholder.svg' },
      { id: '2', name: 'Brosur A4', category: 'Brosur', price: 15000, image: '/assets/img/placeholder.svg' },
      { id: '3', name: 'Kartu Nama', category: 'Kartu Nama', price: 30000, image: '/assets/img/placeholder.svg' },
    ];

    const { unmount } = await renderProductsSection(products);

    for (const p of products) {
      // Use getAllByText since category names also appear in the filter dropdown
      // and product names may match category names (e.g., "Kartu Nama")
      expect(screen.getAllByText(p.name).length).toBeGreaterThan(0);
      expect(screen.getAllByText(p.category).length).toBeGreaterThan(0);
      // Price is formatted via formatCurrency mock which returns String(v)
      expect(screen.getByText(String(p.price))).toBeTruthy();
    }

    unmount();
  });

  /**
   * Concrete test: empty product list shows empty state message.
   *
   * Validates: Requirements 3.7
   */
  it('empty product list shows empty state message', async () => {
    const { unmount } = await renderProductsSection([]);

    await waitFor(() => {
      expect(screen.getByText('Belum ada produk.')).toBeTruthy();
    });

    unmount();
  });

  /**
   * Concrete test: product count header shows correct total.
   *
   * Validates: Requirements 3.7
   */
  it('product count header shows correct total', async () => {
    const products = [
      { id: '1', name: 'Produk A', category: 'Stiker', price: 5000, image: '/assets/img/placeholder.svg' },
      { id: '2', name: 'Produk B', category: 'Brosur', price: 10000, image: '/assets/img/placeholder.svg' },
    ];

    const { unmount } = await renderProductsSection(products, 2);

    await waitFor(() => {
      expect(screen.getByText('Daftar Produk (2)')).toBeTruthy();
    });

    unmount();
  });

  /**
   * Property: for any list of products, all product names are rendered in the table.
   *
   * Validates: Requirements 3.7
   */
  it('property: all product names are always rendered in the product list', async () => {
    const testCases = fc.sample(
      fc.array(productListItemArbitrary, { minLength: 1, maxLength: 5 }),
      3
    );

    for (const products of testCases) {
      vi.clearAllMocks();
      listCategories.mockResolvedValue(MOCK_CATEGORIES);
      listProductsPaginated.mockResolvedValue(makePaginatedResult(products));

      const { unmount } = render(<ProductsSection />);

      await waitFor(() => {
        expect(listProductsPaginated).toHaveBeenCalled();
      });

      for (const p of products) {
        expect(screen.getByText(p.name)).toBeTruthy();
      }

      unmount();
    }
  });

  /**
   * Concrete test: search filters products by name.
   *
   * Validates: Requirements 3.7
   */
  it('search filters products by name', async () => {
    const products = [
      { id: '1', name: 'Stiker Bulat', category: 'Stiker', price: 5000, image: '/assets/img/placeholder.svg' },
      { id: '2', name: 'Brosur Lipat', category: 'Brosur', price: 15000, image: '/assets/img/placeholder.svg' },
    ];

    // First call returns all products, second call (after search) returns filtered
    listProductsPaginated
      .mockResolvedValueOnce(makePaginatedResult(products))
      .mockResolvedValueOnce(makePaginatedResult([products[0]]));

    const { unmount } = await renderProductsSection(products);

    const searchInput = screen.getByPlaceholderText('Cari nama produk\u2026');
    fireEvent.change(searchInput, { target: { value: 'Stiker' } });

    await waitFor(() => {
      // listProductsPaginated should be called again with search param
      expect(listProductsPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'Stiker' })
      );
    });

    unmount();
  });

  /**
   * Concrete test: category filter calls listProductsPaginated with correct category.
   *
   * Validates: Requirements 3.7
   */
  it('category filter calls listProductsPaginated with the selected category', async () => {
    const products = [
      { id: '1', name: 'Stiker Bulat', category: 'Stiker', price: 5000, image: '/assets/img/placeholder.svg' },
    ];

    listProductsPaginated
      .mockResolvedValueOnce(makePaginatedResult(products))
      .mockResolvedValueOnce(makePaginatedResult([products[0]]));

    const { unmount } = await renderProductsSection(products);

    const catFilter = screen.getByLabelText('Filter kategori');
    fireEvent.change(catFilter, { target: { value: 'Stiker' } });

    await waitFor(() => {
      expect(listProductsPaginated).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'Stiker' })
      );
    });

    unmount();
  });
});

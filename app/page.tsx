type Product = {
  id: number;
  title: string;
  description: string;
  category: string;
  price: number;
  rating: number;
};

export const dynamic = "force-dynamic";

type ProductsResponse = {
  products: Product[];
};

function isProductsResponse(value: unknown): value is ProductsResponse {
  if (typeof value !== "object" || value === null || !("products" in value)) {
    return false;
  }

  return (
    Array.isArray(value.products) &&
    value.products.every(
      (product: unknown) =>
        typeof product === "object" &&
        product !== null &&
        "id" in product &&
        typeof product.id === "number" &&
        "title" in product &&
        typeof product.title === "string" &&
        "description" in product &&
        typeof product.description === "string" &&
        "category" in product &&
        typeof product.category === "string" &&
        "price" in product &&
        typeof product.price === "number" &&
        "rating" in product &&
        typeof product.rating === "number",
    )
  );
}

async function getProducts(): Promise<Product[]> {
  const apiUrl =
    process.env.DUMMYJSON_API_URL ??
    "https://dummyjson.com/products?limit=2";
  const response = await fetch(apiUrl);

  if (!response.ok) {
    throw new Error(`DummyJSON returned HTTP ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!isProductsResponse(data)) {
    throw new Error("DummyJSON returned an unexpected product response.");
  }

  return data.products;
}

export default async function Home() {
  let products: Product[];

  try {
    products = await getProducts();
  } catch (error) {
    console.error("Failed to load products from DummyJSON:", error);
    throw error;
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-zinc-900">DummyJSON products</h1>
        <p className="mt-2 text-zinc-600">Sample products loaded from DummyJSON.</p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <li
            key={product.id}
            className="rounded-lg border border-zinc-200 bg-white p-5"
          >
            <p className="text-sm capitalize text-zinc-500">{product.category}</p>
            <h2 className="mt-2 text-lg font-medium text-zinc-900">
              {product.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              {product.description}
            </p>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="font-semibold text-zinc-900">
                ${product.price.toFixed(2)}
              </span>
              <span className="text-zinc-600">Rating: {product.rating}</span>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}


"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  Search,
  Eye,
  X,
  MessageCircle,
  Save,
  Loader2,
  FlaskConical,
  CheckCircle2,
  XCircle,
  CreditCard,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type MixItem = {
  id: string;
  fragrance_name: string;
  grams: number | null;
  notes: string | null;
};

type MixRequest = {
  id: string;
  request_number: number;
  customer_name: string;
  customer_phone: string;
  bottle_size_ml: number;
  notes: string | null;
  status: string;
  quoted_price: number | null;
  admin_notes: string | null;
  shipping_city: string | null;
  shipping_address: string | null;
  payment_method: string | null;
  payment_status: string;
  payment_proof_url: string | null;
  transaction_reference: string | null;
  created_at: string;
  custom_mix_request_items: MixItem[];
};

const statusLabels: Record<string, string> = {
  pending_review: "Pending Review",
  price_sent: "Price Sent",
  approved: "Approved",
  awaiting_address: "Awaiting Address",
  awaiting_payment: "Awaiting Payment",
  paid: "Paid",
  preparing: "Preparing",
  completed: "Completed",
  rejected: "Rejected",
};

const statusColors: Record<string, string> = {
  pending_review: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  price_sent: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  approved: "text-green-400 bg-green-500/10 border-green-500/20",
  awaiting_address: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  awaiting_payment: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  paid: "text-green-400 bg-green-500/10 border-green-500/20",
  preparing: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  completed: "text-green-400 bg-green-500/10 border-green-500/20",
  rejected: "text-red-400 bg-red-500/10 border-red-500/20",
};

const inputClass =
  "w-full bg-[#11100F] border border-white/10 rounded-lg p-3 text-white outline-none focus:border-[#C6A568] transition";

function money(value: number) {
  return `EGP ${Number(value).toLocaleString("en-EG", {
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-GB");
}

function getWhatsAppNumber(phone: string) {
  let number = phone.replace(/\D/g, "");

  if (number.startsWith("0")) {
    number = "20" + number.slice(1);
  } else if (number.startsWith("1")) {
    number = "20" + number;
  }

  return number;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error !== null) {
    const details = error as Record<string, unknown>;

    return [
      details.message,
      details.details,
      details.hint,
      details.code ? `Code: ${details.code}` : "",
    ]
      .filter(Boolean)
      .map(String)
      .join(" | ");
  }

  return String(error || "An unknown error occurred.");
}

export default function CustomMixesPage() {
  const [requests, setRequests] = useState<MixRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const [selectedRequest, setSelectedRequest] =
    useState<MixRequest | null>(null);

  const [quotedPrice, setQuotedPrice] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const supabase = useMemo(() => createClient(), []);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: queryError } = await supabase
        .from("custom_mix_requests")
        .select(`
          id,
          request_number,
          customer_name,
          customer_phone,
          bottle_size_ml,
          notes,
          status,
          quoted_price,
          admin_notes,
          shipping_city,
          shipping_address,
          payment_method,
          payment_status,
          payment_proof_url,
          transaction_reference,
          created_at,
          custom_mix_request_items (
            id,
            fragrance_name,
            grams,
            notes
          )
        `)
        .order("created_at", { ascending: false });

      if (queryError) {
        throw new Error(getErrorMessage(queryError));
      }

      setRequests((data || []) as unknown as MixRequest[]);
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      console.error("Custom mixes loading error:", errorMessage);
      setError(errorMessage || "Could not load custom mix requests.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesSearch =
        String(request.request_number).includes(query) ||
        request.customer_name.toLowerCase().includes(query) ||
        request.customer_phone.includes(query);

      const matchesStatus =
        filter === "all" || request.status === filter;

      return matchesSearch && matchesStatus;
    });
  }, [requests, search, filter]);

  const pendingCount = requests.filter(
    (request) => request.status === "pending_review"
  ).length;

  const priceSentCount = requests.filter(
    (request) => request.status === "price_sent"
  ).length;

  const paymentReviewCount = requests.filter(
    (request) =>
      request.status === "awaiting_payment" &&
      Boolean(request.payment_proof_url)
  ).length;

  function openRequest(request: MixRequest) {
    setSelectedRequest(request);
    setQuotedPrice(
      request.quoted_price !== null ? String(request.quoted_price) : ""
    );
    setAdminNotes(request.admin_notes || "");
    setMessage("");
  }

  function closeRequest() {
    if (saving) return;
    setSelectedRequest(null);
    setMessage("");
  }

  async function saveQuote() {
    if (!selectedRequest) return;

    const price = Number(quotedPrice);

    if (
      quotedPrice.trim() === "" ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      setMessage("Please enter a valid price greater than zero.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const { error: updateError } = await supabase
        .from("custom_mix_requests")
        .update({
          quoted_price: price,
          admin_notes: adminNotes.trim() || null,
          status: "price_sent",
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedRequest.id);

      if (updateError) {
        throw new Error(getErrorMessage(updateError));
      }

      const updatedRequest: MixRequest = {
        ...selectedRequest,
        quoted_price: price,
        admin_notes: adminNotes.trim() || null,
        status: "price_sent",
      };

      setRequests((current) =>
        current.map((request) =>
          request.id === selectedRequest.id ? updatedRequest : request
        )
      );

      setSelectedRequest(updatedRequest);
      setMessage("Quote saved successfully.");
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function sendWhatsApp() {
    if (!selectedRequest || !selectedRequest.quoted_price) {
      setMessage("Save the quote before sending it.");
      return;
    }

    const phone = getWhatsAppNumber(selectedRequest.customer_phone);

    const fragranceList =
      selectedRequest.custom_mix_request_items
        .map((item, index) => {
          const grams = item.grams !== null ? ` - ${item.grams} g` : "";
          return `${index + 1}. ${item.fragrance_name}${grams}`;
        })
        .join("\n");

    const text = [
      `Hello ${selectedRequest.customer_name},`,
      "",
      `Your custom fragrance mix request #${selectedRequest.request_number} has been reviewed.`,
      "",
      `Bottle size: ${selectedRequest.bottle_size_ml} ml`,
      "",
      "Your fragrance mix:",
      fragranceList,
      "",
      `Final price: ${money(selectedRequest.quoted_price)}`,
      "",
      adminNotes.trim()
        ? `Additional notes: ${adminNotes.trim()}`
        : "",
      "",
      "Please let us know if you approve this offer.",
      "",
      "BAIT AL OUD",
    ]
      .filter(Boolean)
      .join("\n");

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  // Confirm payment after reviewing the customer's receipt.
  async function confirmPayment() {
    if (!selectedRequest) return;

    if (!selectedRequest.payment_proof_url) {
      setMessage("No payment receipt has been uploaded.");
      return;
    }

    const confirmed = window.confirm(
      `Confirm payment for request #${selectedRequest.request_number}?`
    );

    if (!confirmed) return;

    setSaving(true);
    setMessage("");

    try {
      const { error: updateError } = await supabase
        .from("custom_mix_requests")
        .update({
          payment_status: "paid",
          status: "paid",
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedRequest.id)
        .eq("status", "awaiting_payment");

      if (updateError) {
        throw new Error(getErrorMessage(updateError));
      }

      const updatedRequest: MixRequest = {
        ...selectedRequest,
        payment_status: "paid",
        status: "paid",
      };

      setRequests((current) =>
        current.map((request) =>
          request.id === selectedRequest.id ? updatedRequest : request
        )
      );

      setSelectedRequest(updatedRequest);
      setMessage("Payment confirmed successfully.");
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // Reject the uploaded receipt and allow the customer to submit another one.
  async function rejectPaymentProof() {
    if (!selectedRequest || !selectedRequest.payment_proof_url) return;

    const confirmed = window.confirm(
      `Reject this payment proof for request #${selectedRequest.request_number}? The customer will be able to upload a new receipt.`
    );

    if (!confirmed) return;

    setSaving(true);
    setMessage("");

    try {
      const { error: updateError } = await supabase
        .from("custom_mix_requests")
        .update({
          payment_status: "pending",
          payment_proof_url: null,
          transaction_reference: null,
          payment_method: null,
          status: "awaiting_payment",
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedRequest.id)
        .eq("status", "awaiting_payment");

      if (updateError) {
        throw new Error(getErrorMessage(updateError));
      }

      const updatedRequest: MixRequest = {
        ...selectedRequest,
        payment_status: "pending",
        payment_proof_url: null,
        transaction_reference: null,
        payment_method: null,
        status: "awaiting_payment",
      };

      setRequests((current) =>
        current.map((request) =>
          request.id === selectedRequest.id ? updatedRequest : request
        )
      );

      setSelectedRequest(updatedRequest);
      setMessage(
        "Payment proof rejected. The customer can now submit a new receipt."
      );
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // Move a paid custom mix through preparation and completion.
  async function updateRequestStatus(nextStatus: "preparing" | "completed") {
    if (!selectedRequest) return;

    const allowed =
      (selectedRequest.status === "paid" && nextStatus === "preparing") ||
      (selectedRequest.status === "preparing" && nextStatus === "completed");

    if (!allowed) {
      setMessage("This status transition is not allowed.");
      return;
    }

    if (selectedRequest.payment_status !== "paid") {
      setMessage("Confirm the payment before changing the order status.");
      return;
    }

    const nextLabel = statusLabels[nextStatus];
    const confirmed = window.confirm(
      `Change request #${selectedRequest.request_number} to "${nextLabel}"?`
    );

    if (!confirmed) return;

    setSaving(true);
    setMessage("");

    try {
      const { error: updateError } = await supabase
        .from("custom_mix_requests")
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedRequest.id)
        .eq("status", selectedRequest.status);

      if (updateError) {
        throw new Error(getErrorMessage(updateError));
      }

      const updatedRequest: MixRequest = {
        ...selectedRequest,
        status: nextStatus,
      };

      setRequests((current) =>
        current.map((request) =>
          request.id === selectedRequest.id ? updatedRequest : request
        )
      );
      setSelectedRequest(updatedRequest);
      setMessage(`Request status updated to ${nextLabel}.`);
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#11100F] p-5 text-white md:p-10">
      <div className="mx-auto max-w-7xl">
        {/* Back */}
        <Link
          href="/admin"
          className="mb-8 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-[#C6A568]"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="mb-9 flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <p className="text-xs tracking-[3px] text-[#C6A568]">
              STORE MANAGEMENT
            </p>

            <h1 className="mt-3 font-serif text-3xl md:text-4xl">
              Custom Mix Requests
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Review customer fragrance combinations, send price quotes and
              verify payments.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadRequests()}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-lg border border-white/10 px-5 py-3 text-sm hover:border-[#C6A568] disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        {/* Statistics */}
        <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-[#1B1917] p-5">
            <p className="text-sm text-gray-400">Total Requests</p>
            <h2 className="mt-3 text-3xl font-semibold">
              {requests.length}
            </h2>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#1B1917] p-5">
            <p className="text-sm text-gray-400">Pending Review</p>
            <h2 className="mt-3 text-3xl font-semibold text-yellow-400">
              {pendingCount}
            </h2>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#1B1917] p-5">
            <p className="text-sm text-gray-400">Price Sent</p>
            <h2 className="mt-3 text-3xl font-semibold text-blue-400">
              {priceSentCount}
            </h2>
          </div>

          <div className="rounded-xl border border-[#C6A568]/20 bg-[#C6A568]/5 p-5">
            <p className="text-sm text-gray-400">Payment Review</p>
            <h2 className="mt-3 text-3xl font-semibold text-[#C6A568]">
              {paymentReviewCount}
            </h2>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="mb-6 rounded-xl border border-white/10 bg-[#1B1917] p-5">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
              />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by request number, customer or phone..."
                className="w-full rounded-lg border border-white/10 bg-[#11100F] py-3 pl-11 pr-4 text-sm outline-none focus:border-[#C6A568]"
              />
            </div>

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#11100F] px-4 py-3 text-sm outline-none focus:border-[#C6A568]"
            >
              <option value="all">All Statuses</option>

              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 break-words rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            <p className="mb-2 font-medium">
              Could not load custom mix requests:
            </p>
            <p>{error}</p>
          </div>
        )}

        {/* Requests Table */}
        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#1B1917]">
          <div className="flex items-center gap-2 border-b border-white/10 p-5">
            <FlaskConical className="text-[#C6A568]" size={19} />
            <h2 className="font-medium">Requests Collection</h2>
            <span className="ml-auto text-xs text-gray-500">
              {filteredRequests.length} requests
            </span>
          </div>

          {loading ? (
            <div className="p-16 text-center text-gray-400">
              <RefreshCw
                size={25}
                className="mx-auto mb-3 animate-spin text-[#C6A568]"
              />
              Loading requests...
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-16 text-center">
              <FlaskConical
                size={38}
                className="mx-auto text-[#C6A568]"
              />
              <h3 className="mt-4 text-lg">No requests found</h3>
              <p className="mt-2 text-sm text-gray-500">
                New custom fragrance requests will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left text-sm">
                <thead className="bg-white/[0.03] text-gray-500">
                  <tr>
                    <th className="p-4">Request</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Bottle</th>
                    <th className="p-4">Fragrances</th>
                    <th className="p-4">Price</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Payment</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Details</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRequests.map((request) => (
                    <tr
                      key={request.id}
                      className="border-t border-white/5 hover:bg-white/[0.02]"
                    >
                      <td className="p-4 font-semibold text-[#C6A568]">
                        #{request.request_number}
                      </td>

                      <td className="p-4">
                        <p>{request.customer_name}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {request.customer_phone}
                        </p>
                      </td>

                      <td className="p-4">{request.bottle_size_ml} ml</td>

                      <td className="p-4">
                        {request.custom_mix_request_items?.length || 0}
                      </td>

                      <td className="p-4">
                        {request.quoted_price !== null
                          ? money(request.quoted_price)
                          : "Not set"}
                      </td>

                      <td className="p-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs ${
                            statusColors[request.status] ||
                            "border-white/10 text-gray-400"
                          }`}
                        >
                          {statusLabels[request.status] || request.status}
                        </span>
                      </td>

                      <td className="p-4">
                        {request.payment_proof_url ? (
                          <span className="text-xs text-[#C6A568]">
                            Proof submitted
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500">
                            {request.payment_status}
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-xs text-gray-500">
                        {new Date(request.created_at).toLocaleDateString(
                          "en-GB"
                        )}
                      </td>

                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => openRequest(request)}
                          className="inline-flex items-center gap-2 text-[#C6A568] hover:text-white"
                        >
                          <Eye size={17} />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="mt-5 text-xs text-gray-600">
          BAIT AL OUD · CUSTOM MIX MANAGEMENT
        </p>
      </div>

      {/* Request Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-[#1B1917] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#1B1917] p-5">
              <div>
                <p className="text-xs tracking-[3px] text-[#C6A568]">
                  REQUEST DETAILS
                </p>
                <h2 className="mt-2 font-serif text-xl">
                  Request #{selectedRequest.request_number}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeRequest}
                disabled={saving}
                className="p-2 text-gray-400 hover:text-white disabled:opacity-40"
              >
                <X size={21} />
              </button>
            </div>

            <div className="space-y-6 p-5 md:p-7">
              {/* Customer Information */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-[#11100F] p-4">
                  <p className="text-xs text-gray-500">Customer</p>
                  <p className="mt-2">{selectedRequest.customer_name}</p>
                </div>

                <div className="rounded-lg bg-[#11100F] p-4">
                  <p className="text-xs text-gray-500">Phone</p>
                  <p className="mt-2">{selectedRequest.customer_phone}</p>
                </div>

                <div className="rounded-lg bg-[#11100F] p-4">
                  <p className="text-xs text-gray-500">Bottle Size</p>
                  <p className="mt-2">
                    {selectedRequest.bottle_size_ml} ml
                  </p>
                </div>

                <div className="rounded-lg bg-[#11100F] p-4">
                  <p className="text-xs text-gray-500">Request Date</p>
                  <p className="mt-2 text-sm">
                    {formatDate(selectedRequest.created_at)}
                  </p>
                </div>
              </div>

              {/* Fragrance Components */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 font-medium">
                  <FlaskConical size={18} className="text-[#C6A568]" />
                  Fragrance Components
                </h3>

                <div className="space-y-3">
                  {selectedRequest.custom_mix_request_items?.map(
                    (item, index) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-white/5 bg-[#11100F] p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">
                            {index + 1}. {item.fragrance_name}
                          </p>

                          <span className="text-sm text-[#C6A568]">
                            {item.grams !== null
                              ? `${item.grams} g`
                              : "No grams specified"}
                          </span>
                        </div>

                        {item.notes && (
                          <p className="mt-2 text-xs text-gray-500">
                            Note: {item.notes}
                          </p>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Customer Notes */}
              {selectedRequest.notes && (
                <div className="rounded-lg bg-[#11100F] p-4">
                  <p className="mb-2 text-xs text-gray-500">
                    Customer Notes
                  </p>
                  <p className="whitespace-pre-wrap text-sm">
                    {selectedRequest.notes}
                  </p>
                </div>
              )}

              {/* Shipping Information */}
              {(selectedRequest.shipping_city ||
                selectedRequest.shipping_address) && (
                <div className="rounded-lg bg-[#11100F] p-4">
                  <p className="mb-2 text-xs text-gray-500">
                    Shipping Information
                  </p>
                  <p className="text-sm">
                    {selectedRequest.shipping_city}
                  </p>
                  <p className="mt-1 text-sm text-gray-400">
                    {selectedRequest.shipping_address}
                  </p>
                </div>
              )}

              {/* PAYMENT REVIEW */}
              <div className="space-y-4 border-t border-white/10 pt-6">
                <h3 className="flex items-center gap-2 font-medium">
                  <CreditCard size={18} className="text-[#C6A568]" />
                  Payment Information
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-lg bg-[#11100F] p-4">
                    <p className="text-xs text-gray-500">Payment Method</p>
                    <p className="mt-2 text-sm">
                      {selectedRequest.payment_method === "vodafone_cash"
                        ? "Vodafone Cash"
                        : selectedRequest.payment_method === "instapay"
                          ? "InstaPay"
                          : "Not selected"}
                    </p>
                  </div>

                  <div className="rounded-lg bg-[#11100F] p-4">
                    <p className="text-xs text-gray-500">Payment Status</p>
                    <p className="mt-2 text-sm">
                      {selectedRequest.payment_status}
                    </p>
                  </div>

                  <div className="rounded-lg bg-[#11100F] p-4 sm:col-span-2">
                    <p className="text-xs text-gray-500">
                      Transaction Reference
                    </p>
                    <p className="mt-2 break-all text-sm">
                      {selectedRequest.transaction_reference || "Not provided"}
                    </p>
                  </div>
                </div>

                {selectedRequest.payment_proof_url ? (
                  <div className="rounded-xl border border-[#C6A568]/20 bg-[#11100F] p-4">
                    <p className="mb-3 text-sm text-[#C6A568]">
                      Customer Payment Receipt
                    </p>

                    <a
                      href={selectedRequest.payment_proof_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-white underline underline-offset-4 hover:text-[#C6A568]"
                    >
                      <ExternalLink size={16} />
                      Open Full Receipt Image
                    </a>

                    <a
                      href={selectedRequest.payment_proof_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 block"
                    >
                      <img
                        src={selectedRequest.payment_proof_url}
                        alt="Customer payment receipt"
                        className="max-h-[400px] w-full rounded-lg border border-white/10 bg-black object-contain"
                      />
                    </a>

                    {selectedRequest.status === "awaiting_payment" && (
                      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => void confirmPayment()}
                          disabled={saving}
                          className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-500 disabled:opacity-50"
                        >
                          {saving ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={18} />
                          )}
                          Confirm Payment
                        </button>

                        <button
                          type="button"
                          onClick={() => void rejectPaymentProof()}
                          disabled={saving}
                          className="flex items-center justify-center gap-2 rounded-lg border border-red-500/30 px-5 py-3 text-sm text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
                        >
                          {saving ? (
                            <Loader2 size={18} className="animate-spin" />
                          ) : (
                            <XCircle size={18} />
                          )}
                          Reject Proof
                        </button>
                      </div>
                    )}

                    {selectedRequest.payment_status === "paid" && (
                      <p className="mt-4 flex items-center gap-2 text-sm text-green-400">
                        <CheckCircle2 size={18} />
                        Payment has been confirmed.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-white/10 bg-[#11100F] p-4 text-sm text-gray-500">
                    No payment receipt has been submitted yet.
                  </div>
                )}
              </div>

              {/* ORDER WORKFLOW */}
              {(selectedRequest.status === "paid" ||
                selectedRequest.status === "preparing" ||
                selectedRequest.status === "completed") && (
                <div className="space-y-4 border-t border-white/10 pt-6">
                  <h3 className="font-medium">Order Progress</h3>

                  <div className="rounded-lg border border-white/10 bg-[#11100F] p-4">
                    <p className="text-xs text-gray-500">Current Status</p>
                    <span
                      className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs ${
                        statusColors[selectedRequest.status] ||
                        "border-white/10 text-gray-400"
                      }`}
                    >
                      {statusLabels[selectedRequest.status] ||
                        selectedRequest.status}
                    </span>
                    <p className="mt-3 text-xs leading-6 text-gray-500">
                      Update the request after payment has been confirmed.
                      Customers can see the latest status on their tracking page.
                    </p>
                  </div>

                  {selectedRequest.status === "paid" && (
                    <button
                      type="button"
                      onClick={() => void updateRequestStatus("preparing")}
                      disabled={saving}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:opacity-50"
                    >
                      {saving ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <FlaskConical size={18} />
                      )}
                      Start Preparing
                    </button>
                  )}

                  {selectedRequest.status === "preparing" && (
                    <button
                      type="button"
                      onClick={() => void updateRequestStatus("completed")}
                      disabled={saving}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-500 disabled:opacity-50"
                    >
                      {saving ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={18} />
                      )}
                      Mark as Completed
                    </button>
                  )}

                  {selectedRequest.status === "completed" && (
                    <p className="flex items-center gap-2 text-sm text-green-400">
                      <CheckCircle2 size={18} />
                      This custom mix request is completed.
                    </p>
                  )}
                </div>
              )}

              {/* Price Quote */}
              <div className="space-y-4 border-t border-white/10 pt-6">
                <h3 className="font-medium">Price Quote</h3>

                <div>
                  <label className="mb-2 block text-sm text-gray-400">
                    Final Price (EGP)
                  </label>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={quotedPrice}
                    onChange={(e) => setQuotedPrice(e.target.value)}
                    placeholder="Enter final price"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-gray-400">
                    Admin Notes
                  </label>

                  <textarea
                    rows={3}
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Internal or customer-facing notes..."
                    className={inputClass}
                  />
                </div>

                {message && (
                  <div className="break-words rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
                    {message}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => void saveQuote()}
                  disabled={saving}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#C6A568] px-5 py-3 font-medium text-black hover:bg-[#D8B97E] disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Save size={18} />
                  )}
                  {saving ? "Saving..." : "Save Quote & Set Price Sent"}
                </button>

                <button
                  type="button"
                  onClick={sendWhatsApp}
                  disabled={!selectedRequest.quoted_price}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-green-500/30 px-5 py-3 text-green-400 hover:bg-green-500/10 disabled:opacity-40"
                >
                  <MessageCircle size={18} />
                  Open WhatsApp Message
                </button>

                <p className="text-center text-xs text-gray-500">
                  Save the quote first, then open WhatsApp to send it to the
                  customer.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

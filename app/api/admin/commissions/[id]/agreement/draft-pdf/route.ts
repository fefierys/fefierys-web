import {
  renderCommissionAgreementPdf,
} from "@/lib/commissions/commissionAgreementPdfRenderer";
import { getAdminSession } from "@/lib/auth/admin";
import { buildCommissionAgreementDocumentData } from "@/lib/commissions/commissionAgreementDocumentData";
import { getAdminCommissionDetail } from "@/lib/repositories/commissionAdminRepository";
import { getActiveCommissionAgreement } from "@/lib/repositories/commissionAgreements/commissionAgreementDataRepository";
import {
  getCommissionDeliverables,
  getCommissionPaymentPlan,
} from "@/lib/repositories/commissionPayments/commissionPaymentPlanRepository";
import { getCommissionQuotes } from "@/lib/repositories/commissionQuoteRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorResponse(message: string, status: number): Response {
  return Response.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}

export async function GET(
  _request: Request,
  { params }: RouteContext,
): Promise<Response> {
  const session = await getAdminSession();

  if (!session) {
    return errorResponse("Unauthorized.", 401);
  }

  const { id: commissionId } = await params;

  if (!UUID_PATTERN.test(commissionId)) {
    return errorResponse("Commission not found.", 404);
  }

  try {
    const [detail, agreement, quotes] = await Promise.all([
      getAdminCommissionDetail(commissionId),
      getActiveCommissionAgreement(commissionId),
      getCommissionQuotes(commissionId),
    ]);

    if (!detail) {
      return errorResponse("Commission not found.", 404);
    }

    if (
      !agreement ||
      agreement.commissionId !== commissionId ||
      agreement.status !== "draft"
    ) {
      return errorResponse(
        "A draft Agreement is not available for this commission.",
        409,
      );
    }

    const acceptedQuote = quotes.find(
      ({ quote }) =>
        quote.id === agreement.quoteId &&
        quote.status === "accepted",
    );

    if (!acceptedQuote) {
      return errorResponse(
        "The Agreement requires an accepted Quote.",
        409,
      );
    }

    const [paymentStages, deliverables] = await Promise.all([
      getCommissionPaymentPlan(
        commissionId,
        agreement.quoteId,
      ),
      getCommissionDeliverables(
        commissionId,
        agreement.quoteId,
      ),
    ]);

    let documentData;

    try {
      documentData = buildCommissionAgreementDocumentData({
        commission: detail.commission,
        agreement,
        quote: acceptedQuote.quote,
        quoteItems: acceptedQuote.items,
        deliverables,
        paymentStages,
      });
    } catch (error) {
      console.error(
        "Commission Agreement draft PDF validation failed:",
        error,
      );

      return errorResponse(
        "The Agreement is not ready for PDF preview. Review its details, Quote and payment plan.",
        409,
      );
    }

    const pdf =
      await renderCommissionAgreementPdf(
        documentData,
      );

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          `attachment; filename="Fefierys-Agreement-DRAFT-${commissionId}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(
      "Failed to generate Commission Agreement draft PDF:",
      error,
    );

    return errorResponse(
      "The draft PDF could not be generated. Please try again.",
      500,
    );
  }
}
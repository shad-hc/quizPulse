import { Response } from "express"

interface ApiResponse {
    success : boolean,
    message : String | null,
    data? : any,
    errors?: any,
}

const apiResponse = (res: Response,statusCode: number,message:String,
    data:any = null,errors: any = null) => {

    const response:ApiResponse = {
        success: statusCode < 400,
        message: message
    };

    if(data != null){
        response.data = data;
    }
    if(errors != null){
        response.errors = errors;
    }

    return res.status(statusCode).json(response);
}

const apiSuccess = (res:Response,message: String = 'Success',data:any = null) => {
    return apiResponse(res,200,message,data);
}

const apiCreated = (res: Response,message:String,data:any) => {
    return apiResponse(res,201,message,data);
}

const apiBadRequest = (res:Response, message:String = 'Bad request', errors = null) =>
  apiResponse(res, 400, message, null, errors);

const apiUnauthorized = (res:Response, statusCode: number ,message:String = 'Unauthorized') =>
  apiResponse(res, statusCode, message);

const apiForbidden = (res:Response, message:String = 'Forbidden') =>
  apiResponse(res, 403, message);

const apiNotFound = (res:Response, message:String = 'Resource not found') =>
  apiResponse(res, 404, message);

const apiServerError = (res: Response, message:String = 'Internal server error',errors: any) =>
  apiResponse(res, 500, message, null, errors);

export {
  apiResponse,
  apiSuccess,
  apiCreated,
  apiBadRequest,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiServerError,
};

# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /source

# Copy solution and project files
COPY SchoolAdmission.sln ./
COPY src/SchoolAdmission.Api/*.csproj ./src/SchoolAdmission.Api/
COPY tests/SchoolAdmission.Api.Tests/*.csproj ./tests/SchoolAdmission.Api.Tests/

RUN dotnet restore ./src/SchoolAdmission.Api/SchoolAdmission.Api.csproj

# Copy source and publish
COPY . ./
RUN dotnet publish ./src/SchoolAdmission.Api/SchoolAdmission.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish ./

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

ENTRYPOINT ["dotnet", "SchoolAdmission.Api.dll"]

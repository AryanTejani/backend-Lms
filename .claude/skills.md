 When to Use What (Cheat Sheet)                            
  Scenario: Create/Update/Delete single record              
  Use: Prisma                                               
  ────────────────────────────────────────                  
  Scenario: Fetch with 1-2 simple relations                 
  Use: Prisma include                                       
  ────────────────────────────────────────                  
  Scenario: Fetch with 3+ relations or aggregations         
  Use: $queryRaw                                            
  ────────────────────────────────────────                  
  Scenario: Reports, analytics, dashboards                  
  Use: $queryRaw                                            
  ────────────────────────────────────────                  
  Scenario: Full-text search                                
  Use: $queryRaw (PostgreSQL tsvector)                      
  ────────────────────────────────────────                  
  Scenario: Bulk insert/update (1000+ rows)                 
  Use: $queryRaw with UNNEST                                
  ────────────────────────────────────────                  
  Scenario: Session validation (hot path)                   
  Use: $queryRaw + Redis        